import { eq, and } from "drizzle-orm";
import { db } from "../config/database";
import { transactions, merchants, webhookLogs, apiKeys } from "../db/schema";
import { sumopodService, type SumopodWebhookPayload } from "./sumopod";
import { signWebhook } from "../utils/apiKey";
import type { InferInsertModel } from "drizzle-orm";

type NewTransaction = InferInsertModel<typeof transactions>;

export interface CreatePaymentInput {
  merchantId: string;
  externalId: string;
  merchantOrderId: string;
  amount: number;
  currency?: string;
  description: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  successReturnUrl?: string;
  cancelReturnUrl?: string;
  callbackUrl?: string;
  expiresInHours?: number;
  metadata?: Record<string, unknown>;
}

export class PaymentService {
  async createPayment(input: CreatePaymentInput) {
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, input.merchantId),
    });

    if (!merchant) throw new Error("Merchant not found");
    if (!merchant.isActive) throw new Error("Merchant is not active");

    const existingTx = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.merchantId, input.merchantId),
        eq(transactions.merchantOrderId, input.merchantOrderId)
      ),
    });

    if (existingTx) {
      throw new Error(`Order ID '${input.merchantOrderId}' sudah digunakan`);
    }

    const expiresInHours = input.expiresInHours ?? 24;

    const gatewayResult = await sumopodService.createPayment({
      orderId: input.merchantOrderId,
      amount: input.amount,
      currency: input.currency || "IDR",
      expiresInHours,
      successReturnUrl: input.successReturnUrl || merchant.callbackUrl || undefined,
      cancelReturnUrl: input.cancelReturnUrl || merchant.callbackUrl || undefined,
    });

    const newTx: NewTransaction = {
      merchantId: input.merchantId,
      externalId: input.externalId,
      merchantOrderId: input.merchantOrderId,
      amount: input.amount,
      fee: gatewayResult.fee,
      netAmount: gatewayResult.netAmount,
      currency: input.currency || "IDR",
      description: input.description,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      callbackUrl: input.callbackUrl || merchant.callbackUrl,
      expiredAt: new Date(gatewayResult.expiresAt),
      status: sumopodService.mapStatus(gatewayResult.status),
      gatewayPaymentId: gatewayResult.paymentId,
      gatewayOrderId: gatewayResult.orderId,
      paymentLinkUrl: gatewayResult.paymentLinkUrl,
      paymentCode: gatewayResult.paymentCode,
      paymentCodeType: gatewayResult.paymentCodeType,
      paymentChannel: gatewayResult.paymentChannel,
      gatewayRequest: {
        order_id: input.merchantOrderId,
        amount: input.amount,
        currency: input.currency || "IDR",
        expires_in_hours: expiresInHours,
        payment_method_type_code: "QRIS",
      },
      gatewayResponse: gatewayResult.raw,
      metadata: input.metadata,
    };

    const [created] = await db.insert(transactions).values(newTx).returning();
    return created;
  }

  async getTransactionById(id: string, merchantId?: string) {
    const where = merchantId
      ? and(eq(transactions.id, id), eq(transactions.merchantId, merchantId))
      : eq(transactions.id, id);

    return db.query.transactions.findFirst({ where });
  }

  async getTransactionByOrderId(merchantOrderId: string, merchantId: string) {
    return db.query.transactions.findFirst({
      where: and(
        eq(transactions.merchantOrderId, merchantOrderId),
        eq(transactions.merchantId, merchantId)
      ),
    });
  }

  async checkPaymentStatus(transactionId: string) {
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.id, transactionId),
    });

    if (!tx) throw new Error("Transaction not found");
    if (!tx.gatewayPaymentId) return tx;

    const gatewayStatus = await sumopodService.getPaymentStatus(
      tx.gatewayPaymentId
    );

    const newStatus = sumopodService.mapStatus(gatewayStatus.status);

    if (newStatus !== tx.status) {
      const [updated] = await db
        .update(transactions)
        .set({
          status: newStatus,
          paidAt: newStatus === "paid" ? new Date() : tx.paidAt,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transactionId))
        .returning();

      return updated;
    }

    return tx;
  }

  async handleGatewayWebhook(payload: SumopodWebhookPayload) {
    const { event_type, data } = payload;

    // Event test dari Sumopod — acknowledge tapi tidak proses
    if (event_type === "payment.test") {
      console.log("[Webhook] Received test event from Sumopod");
      return { test: true };
    }

    const newStatus = sumopodService.mapEventType(event_type);
    if (!newStatus) {
      console.warn(`[Webhook] Unknown event_type: ${event_type}`);
      return null;
    }

    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.merchantOrderId, data.order_id),
    });

    if (!tx) {
      console.warn(`[Webhook] Transaction not found for order: ${data.order_id}`);
      return null;
    }

    const paidAt = newStatus === "paid"
      ? (data.completed_at ? new Date(data.completed_at) : new Date())
      : tx.paidAt;

    const [updated] = await db
      .update(transactions)
      .set({
        status: newStatus,
        gatewayPaymentId: data.payment_id || tx.gatewayPaymentId,
        paidAt,
        gatewayWebhookData: payload as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id))
      .returning();

    if (tx.callbackUrl) {
      const merchantApiKey = await db.query.apiKeys.findFirst({
        where: and(eq(apiKeys.merchantId, tx.merchantId), eq(apiKeys.isActive, true)),
        columns: { apiKey: true },
      });

      await this.dispatchMerchantWebhook(tx.id, tx.merchantId, tx.callbackUrl, merchantApiKey?.apiKey ?? null, {
        event: event_type,
        transaction: {
          id: updated.id,
          orderId: updated.merchantOrderId,
          externalId: updated.externalId,
          status: updated.status,
          amount: updated.amount,
          fee: updated.fee,
          netAmount: updated.netAmount,
          paidAt: updated.paidAt,
        },
      });
    }

    return updated;
  }

  private async dispatchMerchantWebhook(
    transactionId: string,
    merchantId: string,
    targetUrl: string,
    merchantApiKey: string | null,
    payload: Record<string, unknown>
  ) {
    const [log] = await db
      .insert(webhookLogs)
      .values({
        transactionId,
        merchantId,
        event: payload.event as string,
        payload,
        targetUrl,
        status: "pending",
      })
      .returning();

    const rawPayload = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Timestamp": String(timestamp),
      "X-Webhook-Id": log.id,
    };

    if (merchantApiKey) {
      headers["X-Signature"] = `sha256=${signWebhook(rawPayload, merchantApiKey, timestamp)}`;
    }

    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: rawPayload,
        signal: AbortSignal.timeout(10000),
      });

      await db
        .update(webhookLogs)
        .set({
          status: res.ok ? "success" : "failed",
          responseStatus: res.status,
          responseBody: await res.text(),
          attemptCount: 1,
          succeededAt: res.ok ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(webhookLogs.id, log.id));
    } catch (err) {
      await db
        .update(webhookLogs)
        .set({
          status: "failed",
          responseBody: err instanceof Error ? err.message : "Unknown error",
          attemptCount: 1,
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(webhookLogs.id, log.id));
    }
  }
}

export const paymentService = new PaymentService();
