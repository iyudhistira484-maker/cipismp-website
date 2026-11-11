import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP RFC 6238 (SHA-1, 6 digit, 30 detik) — implementasi kecil tanpa dependensi.
 * QR code dibuat di klien dari otpauth:// URI (tanpa layanan pihak ketiga).
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD = 30;
const DIGITS = 6;

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error("Base32 tidak valid");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function currentStep(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 1000 / PERIOD);
}

/**
 * Verifikasi dengan toleransi ±1 langkah (clock drift). Mengembalikan step yang
 * cocok agar bisa disimpan dan mencegah replay kode yang sama.
 */
export function verifyTotp(secret: string, token: string, at: Date = new Date()): number | null {
  const normalized = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const step = currentStep(at);
  for (const drift of [0, -1, 1]) {
    const candidate = totpCode(secret, step + drift);
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(normalized))) return step + drift;
  }
  return null;
}

export function otpauthUri(secret: string, account: string, issuer = "CipiSMP Store"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(PERIOD) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Kode pemulihan (10 karakter, sekali pakai) untuk 2FA. */
export function generateRecoveryCodes(count = 8): string[] {
  const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(10);
    return [...bytes].map((b) => ALPHA[b % ALPHA.length]).join("").replace(/(.{5})(.{5})/, "$1-$2");
  });
}
