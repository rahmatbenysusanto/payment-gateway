import { Elysia } from "elysia";
import { bearer } from "@elysiajs/bearer";
import { jwt } from "@elysiajs/jwt";

export const adminAuthMiddleware = new Elysia({ name: "admin-auth" })
  .use(bearer())
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "fallback-secret-change-me",
    })
  )
  .derive({ as: "scoped" }, async ({ bearer, jwt, set }) => {
    if (!bearer) {
      set.status = 401;
      throw new Error("Token diperlukan");
    }

    const payload = await jwt.verify(bearer);

    if (!payload || payload.role !== "admin") {
      set.status = 401;
      throw new Error("Token tidak valid atau sudah kedaluarsa");
    }

    return { adminUsername: payload.username as string };
  });
