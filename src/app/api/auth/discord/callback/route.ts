import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { createSession, getCurrentSession } from "@/server/auth/session";
import { DiscordError, DISCORD_STATE_COOKIE, exchangeCode, fetchDiscordProfile } from "@/server/auth/discord";
import { GUEST_COOKIE, mergeGuestCart } from "@/server/cart";
import { env } from "@/server/env";
import { writeAudit } from "@/server/audit";
import { clientIp } from "@/server/csrf";
import { safeNextForRole } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

function back(path: string) {
  return NextResponse.redirect(new URL(path, env.APP_URL));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const cookieValue = jar.get(DISCORD_STATE_COOKIE)?.value ?? null;
  jar.delete(DISCORD_STATE_COOKIE);

  if (url.searchParams.get("error")) return back("/masuk?discord=denied");
  if (!code || !state || !cookieValue) return back("/masuk?discord=invalid");

  const [savedState, nextPath] = cookieValue.split(":");
  if (!savedState || savedState !== state) return back("/masuk?discord=invalid");
  const next = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";

  try {
    const accessToken = await exchangeCode(code);
    const profile = await fetchDiscordProfile(accessToken);

    const linked = await db.query.users.findFirst({ where: eq(users.discordId, profile.id) });
    const current = await getCurrentSession();
    if (current?.user.totpEnabledAt && !current.session.mfaSatisfiedAt) {
      return back(`/masuk/2fa?next=${encodeURIComponent(safeNextForRole(next, current.user.role))}`);
    }
    const requestHeaders = await headers();
    const ip = clientIp(requestHeaders);

    if (!linked) {
      // Belum tertaut: hanya bisa menautkan dari akun yang sudah login (tidak pernah auto-merge lewat email).
      if (!current) return back(`/masuk?discord=unlinked&next=${encodeURIComponent(next)}`);
      if (current.user.role !== "CUSTOMER" && !current.user.totpEnabledAt) {
        return back("/admin/keamanan?discord=mfa-required");
      }
      await db
        .update(users)
        .set({ discordId: profile.id, discordUsername: profile.username, updatedAt: new Date() })
        .where(eq(users.id, current.user.id));
      await writeAudit({
        actor: { id: current.user.id, label: current.user.email },
        action: "account.discord-linked",
        targetType: "user",
        targetId: current.user.id,
        after: { discordId: profile.id, username: profile.username },
        ip,
      });
      return back(current.user.role === "CUSTOMER" ? "/dashboard/keamanan?discord=linked" : "/admin/keamanan?discord=linked");
    }

    // Sudah tertaut: buat sesi baru (2FA tetap diminta bila aktif).
    const session = await createSession({
      userId: linked.id,
      ip,
      userAgent: requestHeaders.get("user-agent"),
    });
    await mergeGuestCart(linked.id, jar.get(GUEST_COOKIE)?.value ?? null);
    await db.update(users).set({ lastLoginAt: new Date(), discordUsername: profile.username }).where(eq(users.id, linked.id));
    await writeAudit({
      actor: { id: linked.id, label: linked.email },
      action: "account.login-discord",
      targetType: "user",
      targetId: linked.id,
      ip,
    });

    const destination = safeNextForRole(next, linked.role);
    if (linked.totpEnabledAt) {
      return back(`/masuk/2fa?next=${encodeURIComponent(destination)}&sid=${encodeURIComponent(session.sessionId)}`);
    }
    return back(destination);
  } catch (error) {
    if (error instanceof DiscordError) {
      console.error("[discord] oauth failed", error.message);
      return back("/masuk?discord=failed");
    }
    console.error("[discord] unexpected error", error);
    return back("/masuk?discord=failed");
  }
}
