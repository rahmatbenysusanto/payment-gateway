import { eq, and } from "drizzle-orm";
import { db } from "../config/database";
import { transactions, webhookLogs } from "../db/schema";
import { signWebhook } from "../utils/apiKey";

export type TransactionRow = typeof transactions.$inferSelect;

/** Error saat provider gateway (DANA Gapura) belum diaktifkan/dikonfigurasi. */
export class GatewayNotConfiguredError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Payment gateway (DANA Gapura) belum dikonfigurasi — fitur ini belum tersedia."
    );
    this.name = "GatewayNotConfiguredError";
  }
}

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
  async createPayment(input: CreatePaymentInput): Promise<TransactionRow> {
    // TODO(Gapura): integrasi Create Order API DANA Gapura — aktifkan kembali pada iterasi berikutnya.
    throw new GatewayNotConfiguredError(
      "Pembuatan transaksi belum tersedia — integrasi DANA Gapura belum dikonfigurasi."
    );
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

  async checkPaymentStatus(transactionId: string): Promise<TransactionRow> {
    // TODO(Gapura): inquiry status transaksi ke API DANA Gapura — aktifkan kembali pada iterasi berikutnya.
    throw new GatewayNotConfiguredError(
      "Pengecekan status belum tersedia — integrasi DANA Gapura belum dikonfigurasi."
    );
  }

  /**
   * Kirim notifikasi ke sistem client (merchant) via callbackUrl-nya.
   * Gateway-agnostic — akan dipanggil ulang oleh handler webhook DANA Gapura
   * pada iterasi berikutnya.
   */
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
