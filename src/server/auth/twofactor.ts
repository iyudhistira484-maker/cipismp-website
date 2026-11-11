import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { decryptSecret, encryptSecret } from "../crypto";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./totp";
import { AuthError, recordMfaFailure } from "./flows";
import { verifyPassword } from "./password";
import { writeAudit } from "../audit";

/**
 * 2FA berbasis TOTP. Secret disimpan terenkripsi dan hanya aktif setelah kode
 * pertama diverifikasi (mencegah akun terkunci karena salah scan QR).
 */
export async function beginTotpSetup(userId: string): Promise<{ secret: string; uri: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new AuthError("Akun tidak ditemukan.");
  const secret = generateTotpSecret();
  await db.update(users).set({ totpSecret: encryptSecret(secret), updatedAt: new Date() }).where(eq(users.id, userId));
  return { secret, uri: otpauthUri(secret, user.email) };
}

export async function confirmTotpSetup(userId: string, code: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.totpSecret) throw new AuthError("Mulai pengaturan 2FA terlebih dahulu.", "code");
  const secret = decryptSecret(user.totpSecret);
  if (!secret) throw new AuthError("Secret 2FA tidak dapat dibaca. Ulangi pengaturan.", "code");
  const step = verifyTotp(secret, code);
  if (step === null) throw new AuthError("Kode tidak valid. Pastikan waktu perangkat benar.", "code");

  await db
    .update(users)
    .set({ totpEnabledAt: new Date(), totpLastStep: step, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await writeAudit({
    actor: { id: user.id, label: user.email },
    action: "auth.2fa.enabled",
    targetType: "user",
    targetId: user.id,
  });
}

/** Verifikasi kode saat login. Kode yang sama tidak bisa dipakai dua kali. */
export async function verifyUserTotp(userId: string, code: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.totpSecret || !user.totpEnabledAt) return false;
  const secret = decryptSecret(user.totpSecret);
  if (!secret) return false;
  const step = verifyTotp(secret, code);
  if (step === null) {
    await recordMfaFailure(userId);
    return false;
  }
  if (user.totpLastStep !== null && step <= user.totpLastStep) return false; // replay
  await db.update(users).set({ totpLastStep: step, updatedAt: new Date() }).where(eq(users.id, userId));
  return true;
}

export async function disableTotp(userId: string, password: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new AuthError("Akun tidak ditemukan.");
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AuthError("Password salah.", "password");
  }
  await db
    .update(users)
    .set({ totpEnabledAt: null, totpSecret: null, totpLastStep: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await writeAudit({
    actor: { id: user.id, label: user.email },
    action: "auth.2fa.disabled",
    targetType: "user",
    targetId: user.id,
  });
}
