"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { authTokens, minecraftProfiles, sessions, users } from "@/server/db/schema";
import { requireCustomer, requireMfaEnrollmentViewer, requireViewer } from "@/server/auth/guard";
import { hashPassword, verifyPassword, checkPasswordLocal, isPasswordBreached } from "@/server/auth/password";
import { changeEmail, AuthError } from "@/server/auth/flows";
import { markMfaSatisfied, revokeAllSessions, revokeSession } from "@/server/auth/session";
import { beginTotpSetup, confirmTotpSetup, disableTotp } from "@/server/auth/twofactor";
import { assertSameOrigin, clientIp } from "@/server/csrf";
import { enforceRateLimit } from "@/server/rate-limit";
import { sha256 } from "@/server/crypto";
import { ids } from "@/server/ids";
import { resolvePlayer } from "@/server/minecraft";
import { env } from "@/server/env";
import { generateVerifyCode } from "@/lib/utils";
import { writeAudit } from "@/server/audit";
import { logoutAction } from "./auth";
import { ProfileError, updateUserProfile } from "@/server/auth/profile";
import { updateNotificationPreferences } from "@/server/auth/notification-preferences";
import { markCustomerNotificationsRead, notify } from "@/server/notifications";

export interface AccountState {
  error?: string;
  success?: string;
  data?: Record<string, string>;
}

async function guard(limit = 10, windowSeconds = 300): Promise<{ ip: string; userId: string; sessionId: string }> {
  const requestHeaders = await headers();
  assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: requestHeaders }));
  const viewer = await requireViewer();
  const ip = clientIp(requestHeaders);
  await enforceRateLimit(`account:${viewer.user.id}`, limit, windowSeconds);
  return { ip, userId: viewer.user.id, sessionId: viewer.sessionId };
}

export async function markNotificationsReadAction(): Promise<void> {
  const requestHeaders = await headers();
  assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: requestHeaders }));
  const viewer = await requireCustomer("/dashboard/notifikasi");
  await enforceRateLimit(`notification-read:${viewer.user.id}`, 30, 60);
  await markCustomerNotificationsRead(viewer.user.id);
  revalidatePath("/dashboard/notifikasi");
}

export async function updateNotificationPreferencesAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  try {
    const requestHeaders = await headers();
    assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: requestHeaders }));
    const viewer = await requireCustomer("/dashboard/notifikasi");
    await enforceRateLimit(`notification-settings:${viewer.user.id}`, 10, 300);
    await updateNotificationPreferences(viewer.user.id, {
      dashboardOrderUpdates: formData.get("dashboardOrderUpdates") === "on",
      emailDeliveryUpdates: formData.get("emailDeliveryUpdates") === "on",
    });
    revalidatePath("/dashboard", "layout");
    return { success: "Pengaturan notifikasi disimpan." };
  } catch (error) {
    if (error instanceof Error && error.name === "RateLimitError") return { error: "Terlalu sering. Coba lagi nanti." };
    throw error;
  }
}

export async function updateProfileAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  try {
    const { ip, userId } = await guard();
    const updated = await updateUserProfile(userId, {
      displayName: String(formData.get("displayName") ?? ""),
      username: String(formData.get("username") ?? ""),
    });
    await writeAudit({ actor: { id: userId, label: updated.username }, action: "account.profile.updated", targetType: "user", targetId: userId, after: updated, ip });
    revalidatePath("/dashboard", "layout");
    revalidatePath("/admin", "layout");
    return { success: "Profil berhasil disimpan." };
  } catch (error) {
    if (error instanceof ProfileError) return { error: error.message };
    if (error instanceof Error && error.name === "RateLimitError") return { error: "Terlalu sering. Coba lagi nanti." };
    throw error;
  }
}

export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  try {
    const { ip, userId, sessionId } = await guard(6);
    const parsed = z
      .object({
        currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
        password: z.string().min(10, "Password baru minimal 10 karakter."),
        passwordConfirm: z.string(),
      })
      .refine((data) => data.password === data.passwordConfirm, {
        message: "Konfirmasi password tidak sama.",
        path: ["passwordConfirm"],
      })
      .safeParse({
        currentPassword: String(formData.get("currentPassword") ?? ""),
        password: String(formData.get("password") ?? ""),
        passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
      });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return { error: "Akun tidak ditemukan." };
    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return { error: "Password saat ini salah." };
    }
    const check = checkPasswordLocal(parsed.data.password, { email: user.email, username: user.username });
    if (!check.valid) return { error: check.issues[0] ?? "Password terlalu lemah." };
    if (await isPasswordBreached(parsed.data.password)) {
      return { error: "Password ini muncul dalam kebocoran data publik. Pilih password lain." };
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: new Date() })
      .where(eq(users.id, userId));
    await revokeAllSessions(userId, sessionId);
    await writeAudit({
      actor: { id: userId, label: user.email },
      action: "account.password.change",
      targetType: "user",
      targetId: userId,
      ip,
    });
    if (user.role === "CUSTOMER") await notify({ userId, kind: "SYSTEM", title: "Password diubah", body: "Password akun telah diubah dan sesi lain dikeluarkan. Jika bukan kamu, segera hubungi bantuan.", href: "/dashboard/keamanan" });
    return { success: "Password diubah. Semua sesi lain sudah dikeluarkan." };
  } catch (error) {
    if (error instanceof Error && error.name === "RateLimitError") return { error: "Terlalu sering. Coba lagi nanti." };
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
}

export async function changeEmailAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  try {
    await guard(4);
    const email = String(formData.get("email") ?? "").trim();
    if (!email.includes("@")) return { error: "Format email tidak valid." };
    await changeEmail((await requireViewer()).user.id, email);
    return env.EMAIL_PROVIDER === "outbox"
      ? { error: "Mode email uji (outbox): pesan hanya disimpan di database dan tidak dikirim ke kotak masuk. Hubungi pengelola untuk mengaktifkan layanan email." }
      : { success: "Permintaan email konfirmasi masuk antrean. Email akan dikirim jika layanan email dan worker aktif; periksa kotak masuk atau spam. Email berubah setelah dikonfirmasi." };
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    if (error instanceof Error && error.name === "RateLimitError") return { error: "Terlalu sering. Coba lagi nanti." };
    throw error;
  }
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const sessionId = String(formData.get("sessionId") ?? "");
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, viewer.user.id)))
    .limit(1);
  if (rows.length === 0) return;
  await revokeSession(sessionId);
  revalidatePath("/dashboard/keamanan");
  revalidatePath("/admin/keamanan");
}

export async function revokeAllOtherSessionsAction(): Promise<void> {
  const viewer = await requireViewer();
  await revokeAllSessions(viewer.user.id, viewer.sessionId);
  revalidatePath("/dashboard/keamanan");
  revalidatePath("/admin/keamanan");
}

export async function unlinkDiscordAction(): Promise<void> {
  const viewer = await requireViewer();
  await db.update(users).set({ discordId: null, discordUsername: null, updatedAt: new Date() }).where(eq(users.id, viewer.user.id));
  await writeAudit({
    actor: { id: viewer.user.id, label: viewer.user.email },
    action: "account.discord-unlinked",
    targetType: "user",
    targetId: viewer.user.id,
  });
  revalidatePath("/dashboard/keamanan");
  revalidatePath("/admin/keamanan");
}

export async function startTotpSetupAction(): Promise<AccountState> {
  try {
    const viewer = await requireMfaEnrollmentViewer();
    const { uri, secret } = await beginTotpSetup(viewer.user.id);
    return { data: { uri, secret } };
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
}

export async function confirmTotpAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  try {
    const viewer = await requireMfaEnrollmentViewer();
    const code = String(formData.get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) return { error: "Masukkan 6 digit kode." };
    await confirmTotpSetup(viewer.user.id, code);
    // The setup code verified this session; older sessions must authenticate again.
    await markMfaSatisfied(viewer.sessionId);
    await revokeAllSessions(viewer.user.id, viewer.sessionId);
    revalidatePath("/dashboard/keamanan");
    revalidatePath("/admin/keamanan");
    if (viewer.user.role === "CUSTOMER") await notify({ userId: viewer.user.id, kind: "SYSTEM", title: "2FA diaktifkan", body: "Verifikasi dua langkah telah diaktifkan pada akunmu.", href: "/dashboard/keamanan" });
    return { success: "2FA aktif. Kode akan diminta pada login berikutnya." };
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
}

export async function disableTotpAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  try {
    const viewer = await requireViewer();
    if (viewer.user.role !== "CUSTOMER") {
      return { error: "2FA wajib untuk staf dan tidak dapat dinonaktifkan." };
    }
    await disableTotp(viewer.user.id, String(formData.get("password") ?? ""));
    revalidatePath("/dashboard/keamanan");
    revalidatePath("/admin/keamanan");
    return { success: "2FA dinonaktifkan." };
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
}

export async function deleteAccountAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const viewer = await requireViewer();
  if (viewer.user.role !== "CUSTOMER") return { error: "Akun staf tidak dapat dihapus sendiri." };
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "HAPUS AKUN") return { error: "Tulis HAPUS AKUN untuk konfirmasi." };

  const user = await db.query.users.findFirst({ where: eq(users.id, viewer.user.id) });
  if (!user) return { error: "Akun tidak ditemukan." };
  if (!(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) {
    return { error: "Password salah." };
  }

  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      email: `deleted+${viewer.user.id}@invalid.local`,
      username: `deleted_${viewer.user.id.slice(-8)}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, viewer.user.id));
  await revokeAllSessions(viewer.user.id);
  await writeAudit({
    actor: { id: viewer.user.id, label: user.email },
    action: "account.deleted",
    targetType: "user",
    targetId: viewer.user.id,
  });
  await logoutAction();
  return { success: "Akun dihapus." };
}

/**
 * Mulai verifikasi akun Minecraft in-game: satu kode sekali pakai yang diketik
 * pemain di server. Kode diikat ke UUID hasil resolusi nama.
 */
export async function startMinecraftVerificationAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const viewer = await requireCustomer();
  try {
    await enforceRateLimit(`mc-verify:${viewer.user.id}`, 5, 600);
    const mcName = String(formData.get("mcName") ?? "").trim();
    if (!mcName) return { error: "Masukkan username Minecraft." };

    const player = await resolvePlayer(mcName);
    const existing = await db.query.minecraftProfiles.findFirst({ where: eq(minecraftProfiles.uuid, player.uuid) });
    if (existing?.verifiedAt && existing.userId && existing.userId !== viewer.user.id) {
      return { error: "Akun Minecraft ini sudah terhubung ke akun lain." };
    }

    // Never reserve or transfer a profile before the in-game proof succeeds.

    const code = generateVerifyCode();
    await db.insert(authTokens).values({
      id: ids.token(),
      type: "MC_VERIFY",
      tokenHash: sha256(code),
      userId: viewer.user.id,
      email: player.name,
      payload: { uuid: player.uuid, playerName: player.name, edition: player.edition, identityMode: env.MINECRAFT_LOOKUP_MODE },
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });

    return {
      success: "Kode dibuat. Ketik di server dalam 15 menit.",
      data: {
        code,
        playerName: player.name,
        uuid: player.uuid,
        edition: player.edition,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "RateLimitError") return { error: "Terlalu sering membuat kode." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}

export async function checkMinecraftVerificationAction(code: string): Promise<AccountState> {
  const viewer = await requireCustomer();
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(normalized)) return { error: "Kode tidak valid. Buat kode baru." };
  const token = await db.query.authTokens.findFirst({
    where: and(eq(authTokens.tokenHash, sha256(normalized)), eq(authTokens.type, "MC_VERIFY"), eq(authTokens.userId, viewer.user.id)),
  });
  if (!token?.usedAt) {
    return { error: token && token.expiresAt <= new Date() ? "Kode kedaluwarsa. Buat kode baru dan coba lagi." : "Belum terverifikasi. Selesaikan langkah di server, lalu cek lagi." };
  }
  const payload = (token.payload ?? {}) as { playerName?: string; edition?: string };
  const profiles = await db.select().from(minecraftProfiles).where(eq(minecraftProfiles.userId, viewer.user.id));
  const profile = profiles.find((p) => p.displayName.toLowerCase() === payload.playerName?.toLowerCase() && p.edition === payload.edition && p.verifiedAt && (env.MINECRAFT_LOOKUP_MODE !== "offline" || p.identityVerifiedVersion === 2));
  if (!profile) return { error: "Akun ini belum terhubung. Buat kode baru atau hubungi bantuan." };
  revalidatePath("/dashboard/minecraft");
  return { success: `Terverifikasi: ${profile.displayName}` };
}

export async function unlinkMinecraftAction(formData: FormData): Promise<void> {
  const viewer = await requireCustomer();
  const profileId = String(formData.get("profileId") ?? "");
  await db
    .update(minecraftProfiles)
    .set({ userId: null, verifiedAt: null, updatedAt: new Date() })
    .where(and(eq(minecraftProfiles.id, profileId), eq(minecraftProfiles.userId, viewer.user.id)));
  revalidatePath("/dashboard/minecraft");
}
