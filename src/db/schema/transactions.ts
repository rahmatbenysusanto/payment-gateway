import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { merchants } from "./merchants";

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "processing",
  "paid",
  "failed",
  "expired",
  "refunded",
  "cancelled",
]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id),

  // Referensi dari sistem client
  externalId: varchar("external_id", { length: 255 }).notNull(),
  merchantOrderId: varchar("merchant_order_id", { length: 255 }).notNull(),

  // Data dari response gateway (DANA Gapura)
  gatewayPaymentId: varchar("gateway_payment_id", { length: 255 }),   // payment_id
  gatewayOrderId: varchar("gateway_order_id", { length: 255 }),        // order_id
  paymentLinkUrl: text("payment_link_url"),                             // payment_link_url
  paymentCode: varchar("payment_code", { length: 255 }),               // payment_code (QRIS string / nomor VA)
  paymentCodeType: varchar("payment_code_type", { length: 50 }),       // payment_code_type
  paymentChannel: varchar("payment_channel", { length: 50 }),          // payment_channel_used

  // Nominal
  amount: integer("amount").notNull(),
  fee: integer("fee"),
  netAmount: integer("net_amount"),
  currency: varchar("currency", { length: 3 }).notNull().default("IDR"),

  // Detail transaksi
  description: text("description"),
  status: transactionStatusEnum("status").notNull().default("pending"),

  // Data customer
  customerName: varchar("customer_name", { length: 255 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 20 }),

  // Callback & expiry
  callbackUrl: text("callback_url"),
  expiredAt: timestamp("expired_at"),
  paidAt: timestamp("paid_at"),

  // Raw data dari gateway
  gatewayRequest: jsonb("gateway_request"),
  gatewayResponse: jsonb("gateway_response"),
  gatewayWebhookData: jsonb("gateway_webhook_data"),

  // Metadata tambahan dari client
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
