import { Elysia, t } from "elysia";
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
  .post(
    "/sumopod",
    async ({ body, set }) => {
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
