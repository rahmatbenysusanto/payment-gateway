import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "fallback-secret-change-me",
      exp: "7d",
    })
  )
  .post(
    "/login",
    async ({ body, jwt, set }) => {
      const validUsername = process.env.ADMIN_USERNAME || "admin";
      const validPassword = process.env.ADMIN_PASSWORD;

      if (!validPassword) {
        set.status = 500;
        return { success: false, message: "ADMIN_PASSWORD belum dikonfigurasi" };
      }

      if (body.username !== validUsername || body.password !== validPassword) {
        set.status = 401;
        return { success: false, message: "Username atau password salah" };
      }

      const token = await jwt.sign({ role: "admin", username: body.username });

      return {
        success: true,
        data: { token, username: body.username },
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: "Login Admin Dashboard",
        tags: ["Auth"],
      },
    }
  );
