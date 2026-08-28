import { relations } from "drizzle-orm";
import { merchants, apiKeys } from "./merchants";
import { transactions } from "./transactions";
import { webhookLogs } from "./webhooks";

export const merchantsRelations = relations(merchants, ({ many }) => ({
  apiKeys: many(apiKeys),
  transactions: many(transactions),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  merchant: one(merchants, {
    fields: [apiKeys.merchantId],
    references: [merchants.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [transactions.merchantId],
    references: [merchants.id],
  }),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  merchant: one(merchants, {
    fields: [webhookLogs.merchantId],
    references: [merchants.id],
  }),
}));
