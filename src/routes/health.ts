import { Elysia } from "elysia";
import { db } from "../config/database";
import { sql } from "drizzle-orm";

export const healthRoutes = new Elysia({ prefix: "/health" })
  .get("/", async () => {
    try {
      await db.execute(sql`SELECT 1`);
      return {
        status: "ok",
        service: "Payment Gateway API",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: "error",
        service: "Payment Gateway API",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      };
    }
  });
