import { Elysia, t } from "elysia";
import { Webhook } from "svix";
import { paymentService } from "../services/payment";
import type { SumopodWebhookPayload } from "../services/sumopod";

const webhookDataSchema = t.Object({
  payment_id: t.String(),
  order_id: t.String(),
  amount: t.Number(),
  fee: t.Number(),
  net_amount: t.Number(),
  status: t.String(),
  payment_method: t.String(),
  completed_at: t.Optional(t.String()),
});

export const webhookRoutes = new Elysia({ prefix: "/webhooks" })
  .derive(async ({ request }) => ({
    rawBody: await request.clone().text(),
  }))
  .post(
    "/sumopod",
    async ({ body, set, headers, rawBody }) => {
      // 1. Verifikasi Webhook Token (simple comparison)
      const token = headers["x-webhook-token"];
      if (!token || token !== process.env.SUMOPOD_WEBHOOK_TOKEN) {
        set.status = 401;
        return { success: false, message: "Unauthorized" };
      }

      // 2. Verifikasi Svix Signature (HMAC-SHA256)
      try {
        const wh = new Webhook(process.env.SUMOPOD_WEBHOOK_SECRET!);
        wh.verify(rawBody, {
          "svix-id": headers["svix-id"] ?? "",
          "svix-timestamp": headers["svix-timestamp"] ?? "",
          "svix-signature": headers["svix-signature"] ?? "",
        });
      } catch {
        set.status = 401;
        return { success: false, message: "Invalid signature" };
      }

      const result = await paymentService.handleGatewayWebhook(
        body as SumopodWebhookPayload
      );

      if (result && "test" in result) {
        return { success: true, message: "Test event received" };
      }

      if (!result) {
        set.status = 404;
        return { success: false, message: "Transaction not found" };
      }

      return { success: true };
    },
    {
      body: t.Object({
        event_type: t.Union([
          t.Literal("payment.completed"),
          t.Literal("payment.failed"),
          t.Literal("payment.expired"),
          t.Literal("payment.test"),
        ]),
        data: webhookDataSchema,
      }),
      detail: {
        summary: "Webhook dari Sumopod",
        tags: ["Webhooks"],
        description:
          "Daftarkan URL ini di dashboard Sumopod sebagai webhook/callback URL. " +
          "Event yang didukung: payment.completed, payment.failed, payment.expired, payment.test",
      },
    }
  );
