import { describe, expect, it } from "vitest";
import { checkPasswordLocal, hashPassword, verifyPassword, PASSWORD_MIN_LENGTH } from "@/server/auth/password";
import { base32Decode, base32Encode, currentStep, generateTotpSecret, otpauthUri, totpCode, verifyTotp } from "@/server/auth/totp";
import { computePluginSignature, verifyPluginSignature } from "@/server/delivery/plugin-auth";
import { generateVerifyCode } from "@/lib/utils";

describe("password", () => {
  it("menolak password pendek atau lemah", () => {
    expect(checkPasswordLocal("pendek").valid).toBe(false);
    expect(checkPasswordLocal("a".repeat(PASSWORD_MIN_LENGTH)).valid).toBe(false);
    expect(checkPasswordLocal("KucingOren2025").valid).toBe(true);
  });

  it("menolak password yang memuat email atau username", () => {
    expect(checkPasswordLocal("cipiplayer2025", { username: "cipiplayer" }).valid).toBe(false);
    expect(checkPasswordLocal("secretword123", { email: "secretword123@example.com" }).valid).toBe(false);
  });

  it("menyimpan hash argon2id dan memverifikasinya", async () => {
    const hash = await hashPassword("KataSandiKuat123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("KataSandiKuat123");
    expect(await verifyPassword("KataSandiKuat123", hash)).toBe(true);
    expect(await verifyPassword("KataSandiKuat124", hash)).toBe(false);
    expect(await verifyPassword("apa pun", "bukan-hash")).toBe(false);
  });

  it("menghasilkan salt berbeda untuk password yang sama", async () => {
    const [a, b] = await Promise.all([hashPassword("KataSandiKuat123"), hashPassword("KataSandiKuat123")]);
    expect(a).not.toBe(b);
  });
});

describe("TOTP", () => {
  it("roundtrip base32", () => {
    const buf = generateTotpSecret();
    expect(base32Encode(base32Decode(buf))).toBe(buf);
  });

  it("membuat kode 6 digit yang dapat diverifikasi pada step sama", () => {
    const secret = generateTotpSecret();
    const now = new Date("2025-03-10T10:00:00.000Z");
    const step = currentStep(now);
    const code = totpCode(secret, step);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code, now)).toBe(step);
  });

  it("menerima satu step toleransi dan menolak kode ngawur", () => {
    const secret = generateTotpSecret();
    const now = new Date("2025-03-10T10:00:00.000Z");
    const previous = totpCode(secret, currentStep(now) - 1);
    expect(verifyTotp(secret, previous, now)).not.toBeNull();
    expect(verifyTotp(secret, "000000", now)).toBeNull();
    expect(verifyTotp(secret, "abc", now)).toBeNull();
  });

  it("membuat URI otpauth yang bisa dipindai", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "player@example.com");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=CipiSMP");
  });
});

describe("signature request plugin (HMAC + timestamp + nonce)", () => {
  const secret = "rahasia-plugin-yang-cukup-panjang";
  const body = JSON.stringify({ code: "ABCD1234", uuid: "33333333-3333-4333-8333-333333333333" });
  const now = () => String(Math.floor(Date.now() / 1000));

  it("menghasilkan format HMAC yang sama dengan Java plugin", () => {
    const fixtureSecret = "test-plugin-secret-0123456789abcdef";
    const fixtureTimestamp = "1762900000";
    const fixtureNonce = "abc123";
    const fixtureBody = "{\"deliveryId\":\"del_1\",\"uuid\":\"33333333-3333-4333-8333-333333333333\",\"player\":\"CipiTest\",\"commands\":[\"lp user CipiTest parent add iron\"],\"reason\":\"PURCHASE\"}";
    expect(computePluginSignature({
      secret: fixtureSecret,
      timestamp: fixtureTimestamp,
      nonce: fixtureNonce,
      body: fixtureBody,
    })).toBe("0082f0749dfa5108e9f2b4a3ee9c07942cd3d5c713687c5b2dcfa40456654264");
  });

  it("menerima signature yang benar", () => {
    const timestamp = now();
    const nonce = "nonce-1";
    const signature = computePluginSignature({ secret, timestamp, nonce, body });
    expect(verifyPluginSignature({ secret, timestamp, nonce, signature, body })).toEqual({ ok: true });
  });

  it("menolak signature salah, body diubah, atau secret berbeda", () => {
    const timestamp = now();
    const nonce = "nonce-2";
    const signature = computePluginSignature({ secret, timestamp, nonce, body });
    expect(verifyPluginSignature({ secret, timestamp, nonce, signature, body: `${body} ` }).ok).toBe(false);
    expect(verifyPluginSignature({ secret: `${secret}x`, timestamp, nonce, signature, body }).ok).toBe(false);
    expect(verifyPluginSignature({ secret, timestamp, nonce, signature: signature.slice(0, -2), body }).ok).toBe(false);
  });

  it("menolak request kedaluwarsa (anti replay)", () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const nonce = "nonce-3";
    const signature = computePluginSignature({ secret, timestamp, nonce, body });
    expect(verifyPluginSignature({ secret, timestamp, nonce, signature, body }).ok).toBe(false);
  });

  it("menolak header yang tidak lengkap", () => {
    expect(verifyPluginSignature({ secret, timestamp: "", nonce: "n", signature: "s", body }).ok).toBe(false);
    expect(verifyPluginSignature({ secret, timestamp: now(), nonce: "", signature: "s", body }).ok).toBe(false);
  });
});

describe("kode verifikasi in-game", () => {
  it("berformat mudah dibaca tanpa karakter ambigu", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateVerifyCode();
      expect(code).toMatch(/^[A-Z2-9]{4,10}$/);
      expect(code).not.toMatch(/[OI01]/);
    }
  });
});
