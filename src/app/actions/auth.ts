"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertSameOrigin, clientIp } from "@/server/csrf";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import {
  AuthError,
  authenticate,
  consumeEmailVerification,
  issueEmailVerification,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "@/server/auth/flows";
import { createSession, clearSessionCookie, getCurrentSession, markMfaSatisfied, rotateSession } from "@/server/auth/session";
import { verifyUserTotp } from "@/server/auth/twofactor";
import { verifyTurnstile } from "@/server/auth/turnstile";
import { mergeGuestCart, GUEST_COOKIE } from "@/server/cart";
import { cookies } from "next/headers";
import { safeNext, safeNextForRole } from "@/lib/safe-redirect";

export interface AuthState {
  error?: string;
  success?: string;
  fields?: Record<string, string>;
}

async function guardMutation(rateKey: string, limit: number, windowSeconds: number): Promise<string> {
  const requestHeaders = await headers();
  assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: requestHeaders }));
  const ip = clientIp(requestHeaders);
  try {
    await enforceRateLimit(`${rateKey}:${ip}`, limit, windowSeconds);
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AuthError("Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.");
    }
    throw error;
  }
  return ip;
}

const registerSchema = z
  .object({
    email: z.string().trim().email("Format email tidak valid."),
    username: z.string().trim().min(3, "Username minimal 3 karakter.").max(20),
    password: z.string().min(10, "Password minimal 10 karakter.").max(200),
    passwordConfirm: z.string(),
    turnstileToken: z.string().optional(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Konfirmasi password tidak sama.",
    path: ["passwordConfirm"],
  });

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  let ip = "unknown";
  try {
    ip = await guardMutation("register:ip", 10, 3600);
    const parsed = registerSchema.safeParse({
      email: String(formData.get("email") ?? ""),
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
      turnstileToken: String(formData.get("cf-turnstile-response") ?? "") || undefined,
    });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] = issue.message;
      return { error: "Periksa kembali data yang diisi.", fields };
    }
    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
      return { error: "Verifikasi bot gagal. Muat ulang halaman dan coba lagi." };
    }
    if (!formData.get("acceptTerms")) {
      return { error: "Kamu harus menyetujui Syarat Layanan dan Kebijakan Privasi.", fields: { acceptTerms: "Wajib disetujui." } };
    }

    const user = await registerUser({
      email: parsed.data.email,
      username: parsed.data.username,
      password: parsed.data.password,
      passwordConfirm: parsed.data.passwordConfirm,
      acceptTerms: true,
      marketingOptIn: Boolean(formData.get("marketingOptIn")),
    });

    const jar = await cookies();
    await mergeGuestCart(user.id, jar.get(GUEST_COOKIE)?.value ?? null);
    await createSession({ userId: user.id, ip, userAgent: (await headers()).get("user-agent") });

    redirect("/verifikasi-email?status=terkirim");
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.message, fields: error.field ? { [error.field]: error.message } : undefined };
    }
    throw error;
  }
}

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email atau username wajib diisi."),
  password: z.string().min(1, "Password wajib diisi."),
  next: z.string().optional(),
});

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const nextPath = safeNext(String(formData.get("next") ?? ""));
  try {
    const ip = await guardMutation("login:ip", 20, 300);
    const parsed = loginSchema.safeParse({
      identifier: String(formData.get("identifier") ?? ""),
      password: String(formData.get("password") ?? ""),
      next: String(formData.get("next") ?? ""),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };

    const remember = Boolean(formData.get("rememberMe"));
    const result = await authenticate({
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      ip,
      userAgent: (await headers()).get("user-agent") ?? "unknown",
    });

    const session = await createSession({
      userId: result.user.id,
      ip,
      userAgent: (await headers()).get("user-agent"),
      rememberMe: remember,
    });

    const jar = await cookies();
    await mergeGuestCart(result.user.id, jar.get(GUEST_COOKIE)?.value ?? null);

    const destination = safeNextForRole(nextPath, result.user.role);
    if (result.requiresMfa) {
      // Sesi belum memenuhi syarat MFA; arahkan ke langkah kedua.
      redirect(`/masuk/2fa?next=${encodeURIComponent(destination)}&sid=${encodeURIComponent(session.sessionId)}`);
    }
    redirect(destination);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    if (error instanceof RateLimitError) return { error: "Terlalu banyak percobaan login. Coba lagi nanti." };
    throw error;
  }
}

export async function verifyMfaAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await guardMutation("mfa:ip", 20, 300);
    const code = String(formData.get("code") ?? "").replace(/\s/g, "");
    const next = safeNext(String(formData.get("next") ?? ""));
    if (!/^\d{6}$/.test(code)) return { error: "Kode 6 digit diperlukan." };

    const current = await getCurrentSession();
    if (!current) return { error: "Sesi tidak ditemukan. Masuk ulang." };
    const ok = await verifyUserTotp(current.user.id, code);
    if (!ok) return { error: "Kode salah atau sudah dipakai. Coba kode berikutnya." };

    await markMfaSatisfied(current.session.id);
    await rotateSession(current.session.id);
    redirect(safeNextForRole(next, current.user.role));
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
}

export async function logoutAction(): Promise<void> {
  const current = await getCurrentSession();
  if (current) {
    const { revokeSession } = await import("@/server/auth/session");
    await revokeSession(current.session.id);
  }
  await clearSessionCookie();
  redirect("/");
}

export async function verifyEmailAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Token verifikasi tidak ditemukan." };
  try {
    await consumeEmailVerification(token);
    return { success: "Email berhasil diverifikasi. Kamu bisa checkout sekarang." };
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
}

export async function resendVerificationAction(): Promise<AuthState> {
  const current = await getCurrentSession();
  if (!current || (current.user.totpEnabledAt && !current.session.mfaSatisfiedAt)) return { error: "Selesaikan login terlebih dahulu." };
  if (current.user.emailVerifiedAt) return { success: "Email kamu sudah terverifikasi." };

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const limit = await import("@/server/rate-limit").then((m) => m.rateLimit(`resend:${current.user.id}`, 1, 60));
  if (!limit.allowed) return { error: "Tunggu satu menit sebelum meminta email lagi." };
  void ip;

  await issueEmailVerification(current.user.id, current.user.email, current.user.username);
  return { success: "Email verifikasi baru sudah dikirim." };
}

export async function forgotPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await guardMutation("forgot:ip", 5, 900);
    const email = String(formData.get("email") ?? "").trim();
    if (!email.includes("@")) return { error: "Format email tidak valid." };
    await requestPasswordReset(email);
    return { success: "Kalau email itu terdaftar, tautan reset sudah kami kirim. Periksa kotak masuk dan spam." };
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await guardMutation("reset:ip", 10, 900);
    const token = String(formData.get("token") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("passwordConfirm") ?? "");
    const email = await resetPassword(token, password, confirm);
    void email;
    return { success: "Password berhasil diubah. Semua sesi lain sudah dikeluarkan — silakan masuk." };
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message, fields: error.field ? { [error.field]: error.message } : undefined };
    throw error;
  }
}
