import { argon2id } from "@noble/hashes/argon2";
import { randomBytes } from "node:crypto";

/** Parameter argon2id mengikuti rekomendasi OWASP (19 MiB, t=2, p=1). */
const MEMORY_KIB = Number(process.env.ARGON2_MEMORY_KIB ?? 19456);
const TIME_COST = Number(process.env.ARGON2_TIME_COST ?? 2);
const PARALLELISM = 1;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = argon2id(password.normalize("NFKC"), salt, {
    t: TIME_COST,
    m: MEMORY_KIB,
    p: PARALLELISM,
    dkLen: 32,
  });
  return `$argon2id$v=19$m=${MEMORY_KIB},t=${TIME_COST},p=${PARALLELISM}$${salt.toString("base64")}$${Buffer.from(hash).toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[1] !== "argon2id") return false;
    const params = Object.fromEntries(
      parts[3]!.split(",").map((kv) => {
        const [k, v] = kv.split("=");
        return [k, Number(v)];
      }),
    ) as { m: number; t: number; p: number };
    const salt = Buffer.from(parts[4]!, "base64");
    const expected = Buffer.from(parts[5]!, "base64");
    const actual = argon2id(password.normalize("NFKC"), salt, {
      t: params.t,
      m: params.m,
      p: params.p,
      dkLen: expected.length,
    });
    return Buffer.from(actual).equals(expected);
  } catch {
    return false;
  }
}

/** Daftar kecil password yang sering dipakai; dicek tanpa jaringan. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "1234567890", "qwerty123", "iloveyou",
  "admin123", "letmein123", "cipismp123", "minecraft", "minecraft123", "12345678",
  "123456789", "qwertyuiop", "sayang123", "bismillah", "indonesia", "jakarta123",
]);

export interface PasswordCheck {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  issues: string[];
  breached?: boolean;
}

/** Aturan minimum: >= 10 karakter, tidak terlalu umum, tidak memuat email/username. */
export function checkPasswordLocal(password: string, context: { email?: string; username?: string } = {}): PasswordCheck {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`Minimal ${PASSWORD_MIN_LENGTH} karakter.`);
  if (password.length > PASSWORD_MAX_LENGTH) issues.push("Terlalu panjang.");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) issues.push("Gunakan huruf besar dan kecil.");
  if (!/\d/.test(password)) issues.push("Sertakan minimal satu angka.");
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) issues.push("Password ini terlalu umum.");
  const emailLocal = context.email?.split("@")[0]?.toLowerCase();
  if (emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal)) issues.push("Password tidak boleh memuat email.");
  if (context.username && context.username.length >= 4 && lower.includes(context.username.toLowerCase()))
    issues.push("Password tidak boleh memuat username.");

  let score: PasswordCheck["score"] = 0;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score++;
  if (password.length >= 14) score++;
  if (/[^A-Za-z0-9]/.test(password) && password.length >= 12) score++;
  const clamped = (issues.length > 0 ? Math.min(score, 2) : score) as PasswordCheck["score"];

  return { valid: issues.length === 0, score: clamped, issues };
}

/**
 * Pengecekan kebocoran password lewat HIBP k-anonymity (hanya 5 karakter pertama
 * hash SHA-1 yang dikirim). Gagal jaringan = tidak memblokir (fail-open) dan
 * dicatat di log; keputusan akhir tetap aturan lokal.
 */
export async function isPasswordBreached(password: string, timeoutMs = 2500): Promise<boolean> {
  try {
    // HIBP memakai SHA-1; hanya 5 karakter pertama hash yang dikirim (k-anonymity).
    const sha1 = await sha1Hex(password);
    const prefix = sha1.slice(0, 5);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { "Add-Padding": "true" },
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = await res.text();
    const suffix = sha1.slice(5);
    return body
      .split("\n")
      .some((line) => line.split(":")[0]?.trim() === suffix);
  } catch {
    return false;
  }
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
