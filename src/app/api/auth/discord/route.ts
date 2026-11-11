import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBase64 } from "@/server/crypto";
import { buildAuthorizeUrl, DISCORD_STATE_COOKIE, discordConfig } from "@/server/auth/discord";
import { getSettings } from "@/server/settings";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/dashboard";
  const settings = await getSettings();

  if (!settings.features.discordLogin || !discordConfig()) {
    return NextResponse.redirect(new URL("/masuk?discord=unavailable", env.APP_URL));
  }

  const state = randomBase64(24);
  const jar = await cookies();
  jar.set(DISCORD_STATE_COOKIE, `${state}:${next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
