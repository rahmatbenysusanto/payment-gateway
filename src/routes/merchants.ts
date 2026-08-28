import { Elysia, t } from "elysia";
import { eq, desc } from "drizzle-orm";
import { db } from "../config/database";
import { merchants, apiKeys } from "../db/schema";
import { generateApiKeyPair } from "../utils/apiKey";
import { adminAuthMiddleware } from "../middleware/adminAuth";

export const merchantRoutes = new Elysia({ prefix: "/merchants" })
  .use(adminAuthMiddleware)

  // GET /merchants — list semua merchant
  .get(
    "/",
    async () => {
      const result = await db.query.merchants.findMany({
        orderBy: [desc(merchants.createdAt)],
        with: { apiKeys: true },
      });
      return { success: true, data: result };
    },
    {
      detail: {
        summary: "List semua Merchant",
        tags: ["Merchants"],
        security: [{ BearerAuth: [] }],
      },
    }
  )

  // POST /merchants — daftarkan merchant baru
  .post(
    "/",
    async ({ body, set }) => {
      const existing = await db.query.merchants.findFirst({
        where: eq(merchants.email, body.email),
      });

      if (existing) {
        set.status = 409;
        return { success: false, message: "Email sudah terdaftar" };
      }

      const [merchant] = await db
        .insert(merchants)
        .values({
          name: body.name,
          email: body.email,
          webhookUrl: body.webhookUrl,
          callbackUrl: body.callbackUrl,
        })
        .returning();

      const { apiKey, secretKey } = generateApiKeyPair();
      await db.insert(apiKeys).values({
        merchantId: merchant.id,
        apiKey,
        secretKey,
        name: "Default Key",
      });

      set.status = 201;
      return {
        success: true,
        data: {
          merchant,
          apiKey,
          secretKey,
          note: "Simpan secretKey ini. Tidak akan ditampilkan lagi. Gunakan secretKey sebagai Bearer token untuk create payment.",
        },
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String({ format: "email" }),
        webhookUrl: t.Optional(t.String()),
        callbackUrl: t.Optional(t.String()),
      }),
      detail: {
        summary: "Daftarkan Merchant Baru",
        tags: ["Merchants"],
        security: [{ BearerAuth: [] }],
      },
    }
  )

  // GET /merchants/:id
  .get(
    "/:id",
    async ({ params, set }) => {
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, params.id),
      });

      if (!merchant) {
        set.status = 404;
        return { success: false, message: "Merchant tidak ditemukan" };
      }

      const merchantWithKeys = await db.query.merchants.findFirst({
        where: eq(merchants.id, params.id),
        with: { apiKeys: true },
      });

      return { success: true, data: merchantWithKeys };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: "Detail Merchant", tags: ["Merchants"], security: [{ BearerAuth: [] }] },
    }
  )

  // PUT /merchants/:id — update nama, email, webhook URL, callback URL, status
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, params.id),
      });

      if (!merchant) {
        set.status = 404;
        return { success: false, message: "Merchant tidak ditemukan" };
      }

      const [updated] = await db
        .update(merchants)
        .set({
          name: body.name ?? merchant.name,
          email: body.email ?? merchant.email,
          webhookUrl: body.webhookUrl !== undefined ? body.webhookUrl : merchant.webhookUrl,
          callbackUrl: body.callbackUrl !== undefined ? body.callbackUrl : merchant.callbackUrl,
          isActive: body.isActive !== undefined ? body.isActive : merchant.isActive,
          updatedAt: new Date(),
        })
        .where(eq(merchants.id, params.id))
        .returning();

      return { success: true, data: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 2 })),
        email: t.Optional(t.String({ format: "email" })),
        webhookUrl: t.Optional(t.Nullable(t.String())),
        callbackUrl: t.Optional(t.Nullable(t.String())),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Update Merchant",
        tags: ["Merchants"],
        security: [{ BearerAuth: [] }],
      },
    }
  )

  // POST /merchants/:id/api-keys — generate API key baru
  .post(
    "/:id/api-keys",
    async ({ params, body, set }) => {
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, params.id),
      });

      if (!merchant) {
        set.status = 404;
        return { success: false, message: "Merchant tidak ditemukan" };
      }

      const { apiKey, secretKey } = generateApiKeyPair();
      const [key] = await db
        .insert(apiKeys)
        .values({
          merchantId: merchant.id,
          apiKey,
          secretKey,
          name: body.name || "New Key",
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        })
        .returning();

      return {
        success: true,
        data: {
          id: key.id,
          name: key.name,
          apiKey,
          secretKey,
          expiresAt: key.expiresAt,
          note: "Simpan secretKey ini. Tidak akan ditampilkan lagi. Gunakan secretKey sebagai Bearer token untuk create payment.",
        },
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        expiresAt: t.Optional(t.String()),
      }),
      detail: {
        summary: "Generate API Key Baru",
        tags: ["Merchants"],
        security: [{ BearerAuth: [] }],
      },
    }
  )

  // DELETE /merchants/:id/api-keys/:keyId — nonaktifkan API key
  .delete(
    "/:id/api-keys/:keyId",
    async ({ params, set }) => {
      const key = await db.query.apiKeys.findFirst({
        where: eq(apiKeys.id, params.keyId),
      });

      if (!key || key.merchantId !== params.id) {
        set.status = 404;
        return { success: false, message: "API key tidak ditemukan" };
      }

      await db
        .update(apiKeys)
        .set({ isActive: false })
        .where(eq(apiKeys.id, params.keyId));

      return { success: true, message: "API key dinonaktifkan" };
    },
    {
      params: t.Object({ id: t.String(), keyId: t.String() }),
      detail: {
        summary: "Nonaktifkan API Key",
        tags: ["Merchants"],
        security: [{ BearerAuth: [] }],
      },
    }
  );
