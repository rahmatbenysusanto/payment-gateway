import crypto from "crypto";

export function generateApiKeyPair(): { apiKey: string; secretKey: string } {
  const apiKey = `pgw_pk_${crypto.randomBytes(16).toString("hex")}`;
  const secretKey = `pgw_sk_${crypto.randomBytes(32).toString("hex")}`;
  return { apiKey, secretKey };
}

// Buat HMAC-SHA256 signature untuk webhook
// Format: HMAC("apiKey", "${timestamp}.${rawPayload}")
export function signWebhook(rawPayload: string, apiKey: string, timestamp: number): string {
  return crypto
    .createHmac("sha256", apiKey)
    .update(`${timestamp}.${rawPayload}`)
    .digest("hex");
}

// Verifikasi signature webhook (bisa dipakai merchant untuk testing)
export function verifyWebhook(rawPayload: string, apiKey: string, timestamp: number, signature: string): boolean {
  const expected = signWebhook(rawPayload, apiKey, timestamp);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
