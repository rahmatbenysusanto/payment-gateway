import { Elysia } from "elysia";

/**
 * Callback DANA Gapura — TAHAP STUB.
 *
 * Semua endpoint WAJIB membalas HTTP 200 apa pun isi request-nya.
 * Body mentah + headers hanya dicatat ke console log.
 * Verifikasi signature SNAP (X-TIMESTAMP / X-SIGNATURE / X-PARTNER-ID)
 * dan pemrosesan transaksi dilakukan pada iterasi berikutnya (setelah
 * kredensial DANA diberikan).
 *
 * Penting: handler sengaja TIDAK mendeklarasikan schema `body` dan TIDAK
 * menyentuh context `body` — supaya Elysia tidak melakukan parsing JSON di
 * luar handler. Body malformed pun tidak akan pernah menghasilkan
 * error / status non-200.
 */

/** Catat callback mentah ke console untuk debugging. Selalu aman (tidak pernah throw). */
export async function logCallback(source: string, request: Request): Promise<void> {
  let rawBody = "(body tidak dapat dibaca)";
  try {
    rawBody = (await request.clone().text()) || "(kosong)";
  } catch {
    // Abaikan — endpoint tetap harus membalas 200.
  }
  // Key header hasil entries() selalu huruf kecil (x-timestamp, x-signature, x-partner-id, ...)
  const headers = Object.fromEntries(request.headers.entries());
  console.log(`[Gapura:${source}] ${request.method} ${request.url}`);
  console.log(`[Gapura:${source}] headers:`, headers);
  console.log(`[Gapura:${source}] body:`, rawBody);
}

const FINISH_REDIRECT_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pembayaran Selesai</title>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6fb;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a2233;">
    <div style="max-width:420px;width:calc(100% - 32px);background:#fff;border-radius:16px;padding:40px 32px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08);">
      <div style="width:56px;height:56px;margin:0 auto 20px;border-radius:50%;background:#e6f7ec;color:#0a7a3d;font-size:28px;line-height:56px;">&#10003;</div>
      <h1 style="margin:0 0 8px;font-size:22px;">Pembayaran Selesai</h1>
      <p style="margin:0 0 24px;color:#5a6478;font-size:15px;line-height:1.5;">Terima kasih! Status pembayaran Anda sudah kami terima. Anda dapat kembali ke aplikasi.</p>
      <p style="margin:0;color:#9aa3b5;font-size:13px;">Jika halaman ini tidak tertutup otomatis, silakan tutup tab browser ini.</p>
    </div>
    <script>try{if(window.opener&&!window.opener.closed)window.close()}catch(e){}</script>
  </body>
</html>`;

async function serveFinishRedirect(request: Request): Promise<Response> {
  await logCallback("finish-redirect", request);
  return new Response(FINISH_REDIRECT_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Notify server-to-server DANA (SNAP). Selalu HTTP 200 dengan body
 * `responseCode` standar SNAP — body inilah yang DANA validasi, bukan
 * sekadar status 200. GET juga dijawab sama (dipakai DANA untuk validasi URL).
 * - finish-payment  → SNAP service code 56 → 2005600
 * - disburse-notify → SNAP service code 43 → 2004300
 */
const SNAP_RESPONSE_CODE: Record<string, { responseCode: string; responseMessage: string }> = {
  "finish-payment": { responseCode: "2005600", responseMessage: "Successful" },
  "disburse-notify": { responseCode: "2004300", responseMessage: "Successful" },
};

export async function serveNotify(source: string, request: Request) {
  await logCallback(source, request);
  return SNAP_RESPONSE_CODE[source] ?? { responseCode: "2000000", responseMessage: "Successful" };
}

const GAPURA_TAG = "Webhooks";

export const webhookRoutes = new Elysia({ prefix: "/webhooks" })
  .get("/gapura/finish-payment", ({ request }) => serveNotify("finish-payment", request), {
    detail: {
      summary: "Finish Payment — validasi URL (GET)",
      tags: [GAPURA_TAG],
      description: "Balasan GET untuk validasi URL oleh DANA. Selalu HTTP 200.",
    },
  })
  .post(
    "/gapura/finish-payment",
    ({ request }) => serveNotify("finish-payment", request),
    {
      detail: {
        summary: "Finish Payment (notifikasi server-to-server DANA Gapura)",
        tags: [GAPURA_TAG],
        description:
          "Daftarkan URL ini sebagai Finish Payment URL di dashboard DANA Gapura. " +
          "Dipanggil server-to-server saat pembayaran selesai/berubah status. " +
          "Tahap stub: selalu membalas HTTP 200 dan mencatat body + headers ke log.",
      },
    }
  )
  .get("/gapura/disburse-notify", ({ request }) => serveNotify("disburse-notify", request), {
    detail: {
      summary: "Disburse to Bank Notify — validasi URL (GET)",
      tags: [GAPURA_TAG],
      description: "Balasan GET untuk validasi URL oleh DANA. Selalu HTTP 200.",
    },
  })
  .post(
    "/gapura/disburse-notify",
    ({ request }) => serveNotify("disburse-notify", request),
    {
      detail: {
        summary: "Notifikasi disburse ke bank (server-to-server DANA Gapura)",
        tags: [GAPURA_TAG],
        description:
          "Daftarkan URL ini sebagai Disburse to Bank Notify URL di dashboard DANA Gapura. " +
          "Dipanggil server-to-server saat status transfer ke bank berubah. " +
          "Tahap stub: selalu membalas HTTP 200 dan mencatat body + headers ke log.",
      },
    }
  )
  .get(
    "/gapura/finish-redirect",
    ({ request }) => serveFinishRedirect(request),
    {
      detail: {
        summary: "Halaman selesai bayar (redirect browser dari DANA Gapura)",
        tags: [GAPURA_TAG],
        description:
          "Daftarkan URL ini sebagai Finish Redirect URL di dashboard DANA Gapura. " +
          "Browser payer diarahkan ke sini setelah selesai di halaman checkout DANA. " +
          "Menampilkan halaman HTML 'Pembayaran Selesai' (HTTP 200). POST juga diterima.",
      },
    }
  )
  .post("/gapura/finish-redirect", ({ request }) => serveFinishRedirect(request));
