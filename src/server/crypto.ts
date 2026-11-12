import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Enkripsi secret di database (kredensial gateway, password RCON, TOTP secret).
 * AES-256-GCM, format: v1.<iv_b64>.<tag_b64>.<cipher_b64>
 */
const KEY = Buffer.from(env.ENCRYPTION_KEY, "base64");

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const iv = Buffer.from(parts[1]!, "base64");
    const tag = Buffer.from(parts[2]!, "base64");
    const data = Buffer.from(parts[3]!, "base64");
    const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Nilai terenkripsi untuk ditampilkan di admin tanpa membocorkan isinya. */
export function maskSecret(payload: string | null | undefined): string {
  if (!payload) return "";
  const value = decryptSecret(payload);
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(8);
  return `${value.slice(0, 4)}${"•".repeat(12)}${value.slice(-4)}`;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hmacSha256(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function hmacSha256Base64(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64");
}

export function sha512(input: string): string {
  return createHash("sha512").update(input, "utf8").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function randomBase64(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
