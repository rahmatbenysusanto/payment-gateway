import { Elysia, t } from "elysia";
import { sql, gte, lt, and } from "drizzle-orm";
import { db } from "../config/database";
import { transactions, merchants } from "../db/schema";
import { adminAuthMiddleware } from "../middleware/adminAuth";

export const reportRoutes = new Elysia({ prefix: "/admin/reports" })
  .use(adminAuthMiddleware)

  .get(
    "/monthly",
    async ({ query }) => {
      // Default: bulan ini
      const now = new Date();
      const monthStr = query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const [year, month] = monthStr.split("-").map(Number);
      const startDate = new Date(year!, month! - 1, 1);
      const endDate = new Date(year!, month!, 1);

      // Agregasi per merchant
      const rows = await db
        .select({
          merchantId: transactions.merchantId,
          total: sql<number>`count(*)::int`,
          paid: sql<number>`count(case when ${transactions.status} = 'paid' then 1 end)::int`,
          failed: sql<number>`count(case when ${transactions.status} in ('failed', 'expired', 'cancelled') then 1 end)::int`,
          pending: sql<number>`count(case when ${transactions.status} in ('pending', 'processing') then 1 end)::int`,
          totalAmount: sql<number>`coalesce(sum(case when ${transactions.status} = 'paid' then ${transactions.amount} end), 0)::bigint`,
          totalNetAmount: sql<number>`coalesce(sum(case when ${transactions.status} = 'paid' then ${transactions.netAmount} end), 0)::bigint`,
        })
        .from(transactions)
        .where(and(gte(transactions.createdAt, startDate), lt(transactions.createdAt, endDate)))
        .groupBy(transactions.merchantId);

      // Ambil semua merchant untuk nama
      const merchantList = await db.query.merchants.findMany({
        columns: { id: true, name: true },
      });
      const merchantMap = Object.fromEntries(merchantList.map((m) => [m.id, m.name]));

      const byMerchant = rows.map((r) => ({
        merchantId: r.merchantId,
        merchantName: merchantMap[r.merchantId] ?? "Unknown",
        total: Number(r.total),
        paid: Number(r.paid),
        failed: Number(r.failed),
        pending: Number(r.pending),
        totalAmount: Number(r.totalAmount),
        totalNetAmount: Number(r.totalNetAmount),
      })).sort((a, b) => b.totalNetAmount - a.totalNetAmount);

      // Overall totals
      const overall = byMerchant.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          paid: acc.paid + r.paid,
          failed: acc.failed + r.failed,
          pending: acc.pending + r.pending,
          totalAmount: acc.totalAmount + r.totalAmount,
          totalNetAmount: acc.totalNetAmount + r.totalNetAmount,
        }),
        { total: 0, paid: 0, failed: 0, pending: 0, totalAmount: 0, totalNetAmount: 0 }
      );

      return {
        success: true,
        data: {
          month: monthStr,
          overall,
          byMerchant,
        },
      };
    },
    {
      query: t.Object({
        month: t.Optional(t.String({ description: "Format YYYY-MM, default bulan ini" })),
      }),
      detail: {
        summary: "Laporan bulanan per merchant",
        tags: ["Admin"],
        security: [{ BearerAuth: [] }],
      },
    }
  );
