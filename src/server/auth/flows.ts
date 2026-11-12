import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { authTokens, loginAttempts, sessions, users, type User } from "../db/schema";
import { ids } from "../ids";
import { logger } from "../logger";
import { sha256 } from "../crypto";
import { randomToken, normalizeEmail } from "@/lib/tokens";
import { getSettings } from "../settings";
import { queueEmail, verifyEmailTemplate, resetPasswordTemplate, loginAlertTemplate, emailChangeTemplate } from "../email";
import { hashPassword, verifyPassword, checkPasswordLocal, isPasswordBreached } from "./password";
import { deviceLabel, revokeAllSessions } from "./session";
import { writeAudit } from "../audit";
import { notify } from "../notifications";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly field?: "email" | "username" | "password" | "token" | "code" | "mcName",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com", "yopmail.com",
  "sharklasers.com", "trashmail.com", "getnada.com", "dispostable.com", "maildrop.cc",
  "temp-mail.org", "fakeinbox.com", "throwawaymail.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  passwordConfirm: string;
  mcName?: string;
  acceptTerms: boolean;
  marketingOptIn: boolean;
}

export async function registerUser(input: RegisterInput): Promise<User> {
  const email = normalizeEmail(input.email);
  const username = input.username.trim();

  if (!USERNAME_RE.test(username)) {
    throw new AuthError("Username 3–20 karakter, hanya huruf, angka, dan garis bawah.", "username");
  }
  if (input.password !== input.passwordConfirm) {
    throw new AuthError("Konfirmasi password tidak sama.", "password");
  }
  if (isDisposableEmail(email)) {
    throw new AuthError("Gunakan email permanen. Email sementara tidak kami terima.", "email");
  }
  if (!input.acceptTerms) {
    throw new AuthError("Kamu harus menyetujui Syarat Layanan dan Kebijakan Privasi.");
  }

  const passwordCheck = checkPasswordLocal(input.password, { email, username });
  if (!passwordCheck.valid) throw new AuthError(passwordCheck.issues[0] ?? "Password terlalu lemah.", "password");

  if (await isPasswordBreached(input.password)) {
    throw new AuthError("Password ini muncul dalam kebocoran data publik. Pilih password lain.", "password");
  }

  const existingEmail = await db.query.users.findFirst({
    where: eq(sql`lower(${users.email})`, email),
  });
  if (existingEmail) throw new AuthError("Email ini sudah terdaftar. Coba masuk atau atur ulang password.", "email");

  const existingUsername = await db.query.users.findFirst({
    where: eq(sql`lower(${users.username})`, username.toLowerCase()),
  });
  if (existingUsername) throw new AuthError("Username ini sudah dipakai.", "username");

  const settings = await getSettings();
  const userId = ids.user();
  const inserted = await db
    .insert(users)
    .values({
      id: userId,
      email,
      username,
      passwordHash: await hashPassword(input.password),
      marketingOptIn: input.marketingOptIn,
      role: "CUSTOMER",
    })
    .returning();

  await db.insert(
    // catatan hukum: versi dokumen yang disetujui disimpan bersama timestamp
    (await import("../db/schema")).legalAcceptances,
  ).values([
    {
      id: ids.legal(),
      userId,
      email,
      docType: "TOS",
      version: settings.legal.tosVersion,
    },
    {
      id: ids.legal(),
      userId,
      email,
      docType: "PRIVACY",
      version: settings.legal.privacyVersion,
    },
  ]);

  await issueEmailVerification(userId, email, username);
  return inserted[0]!;
}

export async function issueEmailVerification(userId: string, email: string, username: string): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 60 * 60_000); // 60 menit
  await db.insert(authTokens).values({
    id: ids.token(),
    type: "EMAIL_VERIFY",
    tokenHash: sha256(token),
    userId,
    email,
    expiresAt,
  });
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/verifikasi-email?token=${token}`;
  await queueEmail({
    to: email,
    content: verifyEmailTemplate({ username, url, expiryMinutes: 60 }),
  });
}

export async function consumeEmailVerification(token: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(authTokens)
      .where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.type, "EMAIL_VERIFY"))).limit(1).for("update");
    if (!row || !row.userId || !row.email) throw new AuthError("Tautan verifikasi tidak valid.", "token");
    if (row.usedAt) throw new AuthError("Tautan ini sudah dipakai. Minta tautan baru bila perlu.", "token");
    if (row.expiresAt.getTime() < Date.now()) throw new AuthError("Tautan verifikasi sudah kedaluwarsa.", "token");
    const [user] = await tx.select().from(users).where(eq(users.id, row.userId)).limit(1).for("update");
    if (!user || user.deletedAt || normalizeEmail(user.email) !== normalizeEmail(row.email)) {
      throw new AuthError("Alamat email sudah berubah. Minta tautan verifikasi baru.", "token");
    }
    const now = new Date();
    await tx.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(users.id, row.userId));
    await tx.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, row.id));
  });
}

export interface LoginResult {
  user: User;
  requiresMfa: boolean;
}

const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$MDEyMzQ1Njc4OWFiY2RlZg==$3Xb0M1Vk5nRMd6rQZ0l3Wg7hHq8kYh8m0j7cZf1k5wA";

/**
 * Autentikasi dengan email ATAU username. Pesan error selalu generik agar tidak
 * membocorkan apakah akun ada. Pesan yang sama juga dipakai saat lockout.
 */
export async function authenticate(input: {
  identifier: string;
  password: string;
  ip: string;
  userAgent: string;
}): Promise<LoginResult> {
  const identifier = input.identifier.trim().toLowerCase();
  const genericError = new AuthError("Email/username atau password salah.");

  await db.insert(loginAttempts).values({
    id: ids.loginAttempt(),
    email: identifier,
    ip: input.ip,
    success: false,
    reason: "attempt",
  });

  const user =
    (await db.query.users.findFirst({ where: eq(sql`lower(${users.email})`, identifier) })) ??
    (await db.query.users.findFirst({ where: eq(sql`lower(${users.username})`, identifier) }));

  if (!user || user.deletedAt) {
    await verifyPassword(input.password, DUMMY_HASH); // samakan waktu respons
    throw genericError;
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AuthError("Akun dikunci sementara karena percobaan login berulang. Coba lagi beberapa menit lagi.");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null;
    await db
      .update(users)
      .set({ failedLoginCount: failed, lockedUntil: lock, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    if (lock) {
      logger.warn("login_locked", { userId: user.id, ip: input.ip });
    }
    throw genericError;
  }

  await db
    .update(users)
    .set({
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: input.ip,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await db.insert(loginAttempts).values({
    id: ids.loginAttempt(),
    email: user.email,
    ip: input.ip,
    success: true,
  });

  // Alert perangkat baru: IP berbeda dari login terakhir.
  if (user.lastLoginIp && user.lastLoginIp !== input.ip) {
    if (user.role === "CUSTOMER") await notify({ userId: user.id, kind: "SYSTEM", title: "Aktivitas masuk dari alamat baru", body: "Password benar digunakan dari alamat yang berbeda. Jika 2FA aktif, kode tetap diperlukan. Periksa sesi jika ini bukan kamu.", href: "/dashboard/keamanan" });
    await queueEmail({
      to: user.email,
      content: loginAlertTemplate({
        username: user.username,
        ip: input.ip,
        device: deviceLabel(input.userAgent),
        at: new Date(),
      }),
    });
  }

  return { user, requiresMfa: Boolean(user.totpEnabledAt) };
}

export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const user = await db.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
  // Selalu sukses dari sisi pemanggil (tanpa membocorkan keberadaan akun).
  if (!user || user.deletedAt) return;

  const token = randomToken(32);
  await db.insert(authTokens).values({
    id: ids.token(),
    type: "PASSWORD_RESET",
    tokenHash: sha256(token),
    userId: user.id,
    email,
    expiresAt: new Date(Date.now() + 45 * 60_000),
  });
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  await queueEmail({
    to: email,
    content: resetPasswordTemplate({ username: user.username, url, expiryMinutes: 45 }),
  });
}

export async function resetPassword(token: string, password: string, passwordConfirm: string): Promise<string> {
  if (password !== passwordConfirm) throw new AuthError("Konfirmasi password tidak sama.", "password");
  const row = await db.query.authTokens.findFirst({
    where: and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.type, "PASSWORD_RESET")),
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw new AuthError("Tautan reset tidak valid atau sudah kedaluwarsa.", "token");
  }
  const user = row.userId ? await db.query.users.findFirst({ where: eq(users.id, row.userId) }) : null;
  if (!user) throw new AuthError("Akun tidak ditemukan.", "token");

  const check = checkPasswordLocal(password, { email: user.email, username: user.username });
  if (!check.valid) throw new AuthError(check.issues[0] ?? "Password terlalu lemah.", "password");
  if (await isPasswordBreached(password)) {
    throw new AuthError("Password ini muncul dalam kebocoran data publik. Pilih password lain.", "password");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
  });

  await revokeAllSessions(user.id);
  await queueEmail({
    to: user.email,
    content: resetPasswordTemplate({ username: user.username, url: `${process.env.APP_URL ?? ""}/masuk`, expiryMinutes: 45 })
      .subject
      ? {
          subject: "Password CipiSMP Store berhasil diubah",
          html: `<p style="font-family:sans-serif;color:#111">Password akun CipiSMP Store kamu baru saja diubah. Semua sesi lain sudah dikeluarkan. Kalau ini bukan kamu, segera hubungi bantuan.</p>`,
          text: "Password akun CipiSMP Store kamu baru saja diubah. Semua sesi lain sudah dikeluarkan.",
        }
      : { subject: "Password diubah", html: "", text: "" },
  });

  await writeAudit({
    actor: { id: user.id, label: user.email },
    action: "auth.password.reset",
    targetType: "user",
    targetId: user.id,
  });

  return user.email;
}

export async function changeEmail(userId: string, newEmailInput: string): Promise<void> {
  const newEmail = normalizeEmail(newEmailInput);
  if (isDisposableEmail(newEmail)) throw new AuthError("Gunakan email permanen.", "email");
  const existing = await db.query.users.findFirst({ where: eq(sql`lower(${users.email})`, newEmail) });
  if (existing && existing.id !== userId) throw new AuthError("Email ini sudah dipakai akun lain.", "email");

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new AuthError("Akun tidak ditemukan.");

  const token = randomToken(32);
  await db.transaction(async (tx) => {
    await tx.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.userId, userId), eq(authTokens.type, "EMAIL_CHANGE"), isNull(authTokens.usedAt)));
    await tx.insert(authTokens).values({
      id: ids.token(), type: "EMAIL_CHANGE", tokenHash: sha256(token), userId, email: newEmail,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
  });
  await queueEmail({
    to: newEmail,
    content: emailChangeTemplate({
      username: user.username,
      newEmail,
      url: `${process.env.APP_URL ?? ""}/verifikasi-perubahan-email?token=${token}`,
    }),
  });
}

export async function consumeEmailChange(token: string): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(authTokens)
      .where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.type, "EMAIL_CHANGE"))).limit(1).for("update");
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now() || !row.userId || !row.email) {
      throw new AuthError("Tautan konfirmasi tidak valid atau kedaluwarsa.", "token");
    }
    const now = new Date();
    await tx.update(users).set({ email: row.email, emailVerifiedAt: null, updatedAt: now }).where(eq(users.id, row.userId));
    await tx.update(authTokens).set({ usedAt: now }).where(and(eq(authTokens.userId, row.userId), eq(authTokens.type, "EMAIL_CHANGE"), isNull(authTokens.usedAt)));
    await tx.update(sessions).set({ revokedAt: now }).where(eq(sessions.userId, row.userId));
    return row.email;
  });
}

/** Batas percobaan verifikasi 2FA agar kode tidak bisa di-brute force. */
export async function recordMfaFailure(userId: string): Promise<void> {
  const since = new Date(Date.now() - 10 * 60_000);
  const attempts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, `mfa:${userId}`), gte(loginAttempts.createdAt, since)));
  const count = attempts[0]?.count ?? 0;
  await db.insert(loginAttempts).values({
    id: ids.loginAttempt(),
    email: `mfa:${userId}`,
    success: false,
    reason: "mfa_failed",
  });
  if (count >= 4) {
    await db
      .update(users)
      .set({ lockedUntil: new Date(Date.now() + 10 * 60_000), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}

export async function activeSessionCount(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  return rows[0]?.count ?? 0;
}
