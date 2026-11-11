import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifikasi request dari plugin: signature = HMAC-SHA256(timestamp.nonce.body).
 * Timestamp maksimum 5 menit untuk mencegah replay, nonce disimpan di database.
 */
export const PLUGIN_MAX_SKEW_SECONDS = 300;

export function pluginSharedSecret(): string | null {
  return process.env.PLUGIN_SHARED_SECRET ?? null;
}

export function computePluginSignature(input: {
  secret: string;
  timestamp: string;
  nonce: string;
  body: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.nonce}.${input.body}`)
    .digest("hex");
}

export function verifyPluginSignature(input: {
  secret: string;
  timestamp: string;
  nonce: string;
  signature: string;
  body: string;
}): { ok: boolean; reason?: string } {
  if (!input.timestamp || !input.nonce || !input.signature) {
    return { ok: false, reason: "Header signature tidak lengkap" };
  }
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "Timestamp tidak valid" };
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > PLUGIN_MAX_SKEW_SECONDS) return { ok: false, reason: "Timestamp kedaluwarsa" };

  const expected = computePluginSignature(input);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "Signature tidak cocok" };
  return { ok: true };
}
