import { Elysia } from "elysia";
import { serveNotify } from "./webhooks";

/**
 * Endpoint notifikasi DANA Gapura dengan path yang dimandatkan (SNAP/ASPI).
 * Dashboard DANA mengharuskan URL berakhiran path berikut — didaftarkan di
 * ROOT domain (bukan di bawah /api):
 *
 *   Finish Payment URL       → https://<host>/v1.0/debit/notify
 *   Disburse to Bank Notify  → https://<host>/v1.0/debit/emoney/transfer-bank/notify.htm
 *
 * Handler sama dengan /api/webhooks/gapura/* (log + HTTP 200 + body responseCode SNAP).
 */
const DANA_TAG = "Webhooks";

export const danaMandatedRoutes = new Elysia()
  .get("/v1.0/debit/notify", ({ request }) => serveNotify("finish-payment", request), {
    detail: {
      summary: "Finish Notify SNAP — validasi URL (GET)",
      tags: [DANA_TAG],
      description: "Balasan GET untuk validasi URL oleh DANA. Selalu HTTP 200.",
    },
  })
  .post("/v1.0/debit/notify", ({ request }) => serveNotify("finish-payment", request), {
    detail: {
      summary: "Finish Notify SNAP — path wajib DANA",
      tags: [DANA_TAG],
      description:
        "Finish Payment URL sesuai dokumentasi DANA (path wajib /v1.0/debit/notify). " +
        "Daftarkan https://<host>/v1.0/debit/notify sebagai Finish Payment URL di dashboard. " +
        "Tahap stub: log request, balas HTTP 200 dengan responseCode 2005600.",
    },
  })
  .get(
    "/v1.0/debit/emoney/transfer-bank/notify.htm",
    ({ request }) => serveNotify("disburse-notify", request),
    {
      detail: {
        summary: "Transfer to Bank Notify SNAP — validasi URL (GET)",
        tags: [DANA_TAG],
        description: "Balasan GET untuk validasi URL oleh DANA. Selalu HTTP 200.",
      },
    }
  )
  .post(
    "/v1.0/debit/emoney/transfer-bank/notify.htm",
    ({ request }) => serveNotify("disburse-notify", request),
    {
      detail: {
        summary: "Transfer to Bank Notify SNAP — path wajib DANA",
        tags: [DANA_TAG],
        description:
          "Disburse to Bank Notify URL sesuai dokumentasi DANA (path wajib " +
          "/v1.0/debit/emoney/transfer-bank/notify.htm). " +
          "Daftarkan https://<host>/v1.0/debit/emoney/transfer-bank/notify.htm di dashboard. " +
          "Tahap stub: log request, balas HTTP 200 dengan responseCode 2004300.",
      },
    }
  );
