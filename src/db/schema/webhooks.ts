import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { transactions } from "./transactions";
import { merchants } from "./merchants";

export const webhookStatusEnum = pgEnum("webhook_status", [
  "pending",
  "success",
  "failed",
]);

export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").references(() => transactions.id),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id),

  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  targetUrl: text("target_url").notNull(),

  status: webhookStatusEnum("status").notNull().default("pending"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  succeededAt: timestamp("succeeded_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
