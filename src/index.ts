import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { merchantRoutes } from "./routes/merchants";
import { transactionRoutes } from "./routes/transactions";
import { adminTransactionRoutes } from "./routes/adminTransactions";
import { webhookRoutes } from "./routes/webhooks";
import { reportRoutes } from "./routes/reports";

const PORT = Number(process.env.PORT) || 3000;

const app = new Elysia()
  .use(
    cors({
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "Payment Gateway API",
          version: "1.0.0",
          description:
            "Centralized payment gateway service — satu integrasi Sumopod untuk semua sistem.",
        },
        components: {
          securitySchemes: {
            BearerAuth: {
              type: "http",
              scheme: "bearer",
              description: "Gunakan API key merchant sebagai Bearer token",
            },
          },
        },
        tags: [
          { name: "Auth", description: "Login dashboard admin" },
          { name: "Health", description: "Status server" },
          { name: "Merchants", description: "Manajemen sistem klien (Allora, Nabungmas, dll)" },
          { name: "Admin", description: "Endpoint admin — semua transaksi lintas merchant" },
          { name: "Transactions", description: "Transaksi pembayaran QRIS (per merchant API key)" },
          { name: "Webhooks", description: "Callback dari Sumopod" },
        ],
      },
    })
  )
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 422;
      return { success: false, message: "Validation error", errors: error.message };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { success: false, message: "Route not found" };
    }
    // Preserve status yang sudah di-set middleware (misal 401 dari auth)
    const currentStatus = set.status as number;
    if (currentStatus && currentStatus >= 400 && currentStatus < 500) {
      return { success: false, message: "message" in error ? error.message : "Request tidak valid" };
    }
    console.error(`[Error] ${code}:`, error);
    set.status = 500;
    return { success: false, message: "Internal server error" };
  })
  .group("/api", (app) =>
    app
      .use(healthRoutes)
      .use(authRoutes)
      .use(merchantRoutes)
      .use(transactionRoutes)
      .use(adminTransactionRoutes)
      .use(webhookRoutes)
      .use(reportRoutes)
  )
  .listen(PORT);

console.log(`\n🚀 Payment Gateway API berjalan di http://localhost:${PORT}`);
console.log(`📖 Swagger docs: http://localhost:${PORT}/swagger\n`);

export type App = typeof app;
