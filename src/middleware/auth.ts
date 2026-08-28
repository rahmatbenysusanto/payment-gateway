import { Elysia } from "elysia";
import { bearer } from "@elysiajs/bearer";
import { eq, and } from "drizzle-orm";
import { db } from "../config/database";
import { apiKeys, merchants } from "../db/schema";

export const authMiddleware = new Elysia({ name: "auth" })
  .use(bearer())
  .derive({ as: "scoped" }, async ({ bearer, set }) => {
    if (!bearer) {
      set.status = 401;
      throw new Error("API key diperlukan");
    }

    const apiKey = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.secretKey, bearer), eq(apiKeys.isActive, true)),
    });

    if (!apiKey) {
      set.status = 401;
      throw new Error("API key tidak valid atau tidak aktif");
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      set.status = 401;
      throw new Error("API key sudah kedaluarsa");
    }

    const merchant = await db.query.merchants.findFirst({
      where: and(eq(merchants.id, apiKey.merchantId), eq(merchants.isActive, true)),
    });

    if (!merchant) {
      set.status = 401;
      throw new Error("Merchant tidak ditemukan atau tidak aktif");
    }

    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id))
      .execute()
      .catch(console.error);

    return { merchant, apiKeyId: apiKey.id };
  });
