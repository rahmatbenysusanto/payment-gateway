import { Elysia, t } from "elysia";
import { desc, eq } from "drizzle-orm";
import { db } from "../config/database";
import { transactions } from "../db/schema";
import { paymentService, GatewayNotConfiguredError } from "../services/payment";
import { authMiddleware } from "../middleware/auth";

export const transactionRoutes = new Elysia({ prefix: "/transactions" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, merchant, set }) => {
      try {
        const tx = await paymentService.createPayment({
          merchantId: merchant.id,
          externalId: String(body.externalId),
          merchantOrderId: body.orderId,
          amount: body.amount,
          currency: body.currency,
          description: body.description,
          customerName: body.customer?.name,
          customerEmail: body.customer?.email,
          customerPhone: body.customer?.phone,
          successReturnUrl: body.successReturnUrl || undefined,
          cancelReturnUrl: body.cancelReturnUrl || undefined,
          callbackUrl: body.callbackUrl || undefined,
          expiresInHours: body.expiresInHours,
          metadata: body.metadata,
        });

        set.status = 201;
        return {
          success: true,
          data: {
            id: tx.id,
            orderId: tx.merchantOrderId,
            externalId: tx.externalId,
            amount: tx.amount,
            fee: tx.fee,
            netAmount: tx.netAmount,
            currency: tx.currency,
            status: tx.status,
            paymentLinkUrl: tx.paymentLinkUrl,
            paymentCode: tx.paymentCode,
            paymentCodeType: tx.paymentCodeType,
            paymentChannel: tx.paymentChannel,
            expiredAt: tx.expiredAt,
          },
        };
      } catch (err) {
        if (err instanceof GatewayNotConfiguredError) throw err;
        set.status = 400;
        return {
          success: false,
          message: err instanceof Error ? err.message : "Gagal membuat transaksi",
        };
      }
    },
    {
      body: t.Object({
        orderId: t.String({ minLength: 1, description: "Order ID unik dari sistem Anda" }),
        externalId: t.Union([t.String(), t.Number()], { description: "ID referensi internal sistem Anda" }),
        amount: t.Number({ minimum: 1000, description: "Nominal dalam Rupiah" }),
        currency: t.Optional(t.String({ default: "IDR" })),
        description: t.String({ minLength: 1 }),
        customer: t.Optional(
          t.Object({
            name: t.Optional(t.String()),
            email: t.Optional(t.String()),
            phone: t.Optional(t.String()),
          })
        ),
        successReturnUrl: t.Optional(t.String({ description: "Redirect setelah bayar sukses" })),
        cancelReturnUrl: t.Optional(t.String({ description: "Redirect jika batal" })),
        callbackUrl: t.Optional(t.String({ description: "Webhook URL sistem Anda" })),
        expiresInHours: t.Optional(t.Number({ minimum: 1, maximum: 72, default: 24 })),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
      detail: {
        summary: "Buat Transaksi QRIS",
        tags: ["Transactions"],
        security: [{ BearerAuth: [] }],
      },
    }
  )
  .get(
    "/",
    async ({ merchant, query }) => {
      const limit = Math.min(Number(query.limit) || 20, 100);
      const offset = Number(query.offset) || 0;

      const result = await db.query.transactions.findMany({
        where: eq(transactions.merchantId, merchant.id),
        orderBy: [desc(transactions.createdAt)],
        limit,
        offset,
      });

      return { success: true, data: result, meta: { limit, offset } };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        summary: "List Transaksi",
        tags: ["Transactions"],
        security: [{ BearerAuth: [] }],
      },
    }
  )
  .get(
    "/:id",
    async ({ params, merchant, set }) => {
      const tx = await paymentService.getTransactionById(params.id, merchant.id);

      if (!tx) {
        set.status = 404;
        return { success: false, message: "Transaksi tidak ditemukan" };
      }

      return { success: true, data: tx };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Detail Transaksi",
        tags: ["Transactions"],
        security: [{ BearerAuth: [] }],
      },
    }
  )
  .post(
    "/:id/check",
    async ({ params, merchant, set }) => {
      const tx = await paymentService.getTransactionById(params.id, merchant.id);

      if (!tx) {
        set.status = 404;
        return { success: false, message: "Transaksi tidak ditemukan" };
      }

      try {
        const updated = await paymentService.checkPaymentStatus(params.id);
        return { success: true, data: updated };
      } catch (err) {
        if (err instanceof GatewayNotConfiguredError) throw err;
        set.status = 400;
        return {
          success: false,
          message: err instanceof Error ? err.message : "Gagal cek status",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Cek Status Pembayaran",
        tags: ["Transactions"],
        security: [{ BearerAuth: [] }],
      },
    }
  );
