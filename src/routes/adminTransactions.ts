import { Elysia, t } from "elysia";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../config/database";
import { transactions, merchants } from "../db/schema";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { paymentService } from "../services/payment";

export const adminTransactionRoutes = new Elysia({ prefix: "/admin/transactions" })
  .use(adminAuthMiddleware)

  .get(
    "/",
    async ({ query }) => {
      const limit = Math.min(Number(query.limit) || 50, 200);
      const offset = Number(query.offset) || 0;

      const where = query.merchantId
        ? eq(transactions.merchantId, query.merchantId)
        : undefined;

      const result = await db.query.transactions.findMany({
        where,
        orderBy: [desc(transactions.createdAt)],
        limit,
        offset,
      });

      // Ambil nama merchant untuk setiap transaksi
      const merchantIds = [...new Set(result.map((tx) => tx.merchantId))];
      const merchantList = merchantIds.length > 0
        ? await db.query.merchants.findMany({
            where: inArray(merchants.id, merchantIds),
            columns: { id: true, name: true },
          })
        : [];
      const merchantMap = Object.fromEntries(merchantList.map((m) => [m.id, m.name]));

      const data = result.map((tx) => ({
        ...tx,
        merchantName: merchantMap[tx.merchantId] ?? "Unknown",
      }));

      return { success: true, data, meta: { limit, offset } };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        merchantId: t.Optional(t.String()),
      }),
      detail: {
        summary: "List semua transaksi (Admin)",
        tags: ["Admin"],
        security: [{ BearerAuth: [] }],
      },
    }
  )

  .get(
    "/:id",
    async ({ params, set }) => {
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, params.id),
      });

      if (!tx) {
        set.status = 404;
        return { success: false, message: "Transaksi tidak ditemukan" };
      }

      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, tx.merchantId),
      });

      return { success: true, data: { ...tx, merchantName: merchant?.name ?? "Unknown" } };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Detail transaksi (Admin)",
        tags: ["Admin"],
        security: [{ BearerAuth: [] }],
      },
    }
  )

  .post(
    "/:id/check",
    async ({ params, set }) => {
      try {
        const updated = await paymentService.checkPaymentStatus(params.id);
        const merchant = updated
          ? await db.query.merchants.findFirst({ where: eq(merchants.id, updated.merchantId) })
          : null;
        return { success: true, data: { ...updated, merchantName: merchant?.name ?? "Unknown" } };
      } catch (err) {
        set.status = 400;
        return { success: false, message: err instanceof Error ? err.message : "Gagal cek status" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Cek status ke Sumopod (Admin)",
        tags: ["Admin"],
        security: [{ BearerAuth: [] }],
      },
    }
  );
