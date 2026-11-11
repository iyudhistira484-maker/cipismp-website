import { env } from "@/server/env";
import { getSettings } from "@/server/settings";

export const DISCORD_STATE_COOKIE = "cipi_discord_state";

export function discordConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${env.APP_URL}/api/auth/discord/callback` };
}

/** Tombol Discord hanya muncul bila kredensial ada DAN fitur dinyalakan admin. */
export async function discordLoginAvailable(): Promise<boolean> {
  const settings = await getSettings();
  return settings.features.discordLogin && discordConfig() !== null;
}

export function buildAuthorizeUrl(state: string, prompt: "none" | "consent" = "none"): string {
  const config = discordConfig();
  if (!config) throw new Error("Discord OAuth belum dikonfigurasi.");
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "identify",
    redirect_uri: config.redirectUri,
    state,
    prompt,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export interface DiscordProfile {
  id: string;
  username: string;
  globalName: string | null;
}

export class DiscordError extends Error {}

export async function exchangeCode(code: string): Promise<string> {
  const config = discordConfig();
  if (!config) throw new DiscordError("Discord OAuth belum dikonfigurasi.");
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new DiscordError("Pertukaran kode Discord gagal.");
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new DiscordError("Discord tidak mengembalikan access token.");
  return json.access_token;
}

export async function fetchDiscordProfile(accessToken: string): Promise<DiscordProfile> {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new DiscordError("Gagal mengambil profil Discord.");
  const json = (await response.json()) as { id?: string; username?: string; global_name?: string | null };
  if (!json.id || !json.username) throw new DiscordError("Profil Discord tidak lengkap.");
  return { id: json.id, username: json.username, globalName: json.global_name ?? null };
}
