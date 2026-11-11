import { cookies } from "next/headers";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import { ids } from "../ids";
import { randomBase64, sha256 } from "../crypto";
import type { Role } from "../rbac";

export const SESSION_COOKIE = "cipi_session";
const IDLE_MINUTES = Number(process.env.SESSION_IDLE_MINUTES ?? 120);
const ABSOLUTE_HOURS = Number(process.env.SESSION_ABSOLUTE_HOURS ?? 168);
const REMEMBER_DAYS = Number(process.env.SESSION_REMEMBER_DAYS ?? 30);

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: Role;
  emailVerifiedAt: Date | null;
  totpEnabledAt: Date | null;
  createdAt: Date;
}

export interface ActiveSession {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  current: boolean;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function createSession(input: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  rememberMe?: boolean;
}): Promise<{ token: string; sessionId: string }> {
  const token = randomBase64(32);
  const tokenHash = sha256(token);
  const now = new Date();
  const sessionId = ids.session();
  const absoluteMs = (input.rememberMe ? REMEMBER_DAYS * 24 : ABSOLUTE_HOURS) * 3_600_000;
  const idleMs = Math.max(IDLE_MINUTES, input.rememberMe ? 60 * 24 : IDLE_MINUTES) * 60_000;

  await db.insert(sessions).values({
    id: sessionId,
    tokenHash,
    userId: input.userId,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: new Date(now.getTime() + absoluteMs),
    idleExpiresAt: new Date(now.getTime() + idleMs),
    ip: input.ip ?? null,
    userAgent: input.userAgent?.slice(0, 500) ?? null,
    rememberMe: input.rememberMe ?? false,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(Math.floor(absoluteMs / 1000)));
  return { token, sessionId };
}

export async function findSessionByToken(token: string) {
  const tokenHash = sha256(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.absoluteExpiresAt, new Date()),
        gt(sessions.idleExpiresAt, new Date()),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Perpanjang idle window, maksimal sekali per menit agar tidak membebani DB. */
export async function touchSession(sessionId: string, lastSeenAt: Date, rememberMe: boolean): Promise<void> {
  if (Date.now() - lastSeenAt.getTime() < 60_000) return;
  const idleMs = Math.max(IDLE_MINUTES, rememberMe ? 60 * 24 : IDLE_MINUTES) * 60_000;
  await db
    .update(sessions)
    .set({ lastSeenAt: new Date(), idleExpiresAt: new Date(Date.now() + idleMs) })
    .where(eq(sessions.id, sessionId));
}

export async function getCurrentSession(): Promise<{ session: typeof sessions.$inferSelect; user: SessionUser } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const found = await findSessionByToken(token);
  if (!found) return null;
  await touchSession(found.session.id, found.session.lastSeenAt, found.session.rememberMe);
  return {
    session: found.session,
    user: {
      id: found.user.id,
      email: found.user.email,
      username: found.user.username,
      displayName: found.user.displayName,
      role: found.user.role,
      emailVerifiedAt: found.user.emailVerifiedAt,
      totpEnabledAt: found.user.totpEnabledAt,
      createdAt: found.user.createdAt,
    },
  };
}

/** Rotasi token sesi (dipanggil setelah login & setelah verifikasi 2FA). */
export async function rotateSession(sessionId: string): Promise<void> {
  const token = randomBase64(32);
  await db.update(sessions).set({ tokenHash: sha256(token) }).where(eq(sessions.id, sessionId));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(REMEMBER_DAYS * 24 * 3600));
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  for (const row of rows) {
    if (exceptSessionId && row.id === exceptSessionId) continue;
    await revokeSession(row.id);
  }
}

export async function listSessions(userId: string, currentSessionId: string): Promise<ActiveSession[]> {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.absoluteExpiresAt, new Date())))
    .orderBy(desc(sessions.lastSeenAt));
  return rows.map((s) => ({
    id: s.id,
    ip: s.ip,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    expiresAt: s.absoluteExpiresAt,
    current: s.id === currentSessionId,
  }));
}

export async function markMfaSatisfied(sessionId: string): Promise<void> {
  await db.update(sessions).set({ mfaSatisfiedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  jar.delete(SESSION_COOKIE);
}

/** Label perangkat sederhana untuk daftar sesi (tanpa dependensi parsing UA). */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Perangkat tidak dikenal";
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome")
      ? "Chrome"
      : ua.includes("firefox")
        ? "Firefox"
        : ua.includes("safari")
          ? "Safari"
          : "Browser";
  const os = ua.includes("android")
    ? "Android"
    : ua.includes("iphone") || ua.includes("ipad")
      ? "iOS"
      : ua.includes("windows")
        ? "Windows"
        : ua.includes("mac os")
          ? "macOS"
          : ua.includes("linux")
            ? "Linux"
            : "OS tidak dikenal";
  return `${browser} · ${os}`;
}
