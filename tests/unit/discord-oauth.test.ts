import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  discordConfig,
  exchangeCode,
  fetchDiscordProfile,
} from "@/server/auth/discord";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Discord OAuth contract", () => {
  it("membentuk authorize URL dengan scope identify, redirect, state, dan prompt", () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "client id/test");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "test-secret");
    const config = discordConfig();
    expect(config).toEqual({
      clientId: "client id/test",
      clientSecret: "test-secret",
      redirectUri: "http://localhost:3000/api/auth/discord/callback",
    });

    const url = new URL(buildAuthorizeUrl("state+random", "consent"));
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("client id/test");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("identify");
    expect(url.searchParams.get("redirect_uri")).toBe(config?.redirectUri);
    expect(url.searchParams.get("state")).toBe("state+random");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("bertukar authorization code via x-www-form-urlencoded dan mengambil profil Bearer", async () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "client-id");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "client-secret");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "123456789012345678", username: "cipiplayer", global_name: "Cipi Player" }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeCode("oauth-code")).resolves.toBe("access-token");
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect(String(tokenUrl)).toBe("https://discord.com/api/oauth2/token");
    expect(tokenInit?.method).toBe("POST");
    expect(tokenInit?.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
    const form = new URLSearchParams(tokenInit?.body as URLSearchParams);
    expect(form.get("client_id")).toBe("client-id");
    expect(form.get("client_secret")).toBe("client-secret");
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("oauth-code");
    expect(form.get("redirect_uri")).toBe("http://localhost:3000/api/auth/discord/callback");

    await expect(fetchDiscordProfile("access-token")).resolves.toEqual({
      id: "123456789012345678",
      username: "cipiplayer",
      globalName: "Cipi Player",
    });
    const [profileUrl, profileInit] = fetchMock.mock.calls[1]!;
    expect(String(profileUrl)).toBe("https://discord.com/api/users/@me");
    expect(profileInit?.headers).toMatchObject({ Authorization: "Bearer access-token" });
  });

  it("menolak OAuth tanpa konfigurasi dan respons token/profil yang invalid", async () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "");
    expect(discordConfig()).toBeNull();
    expect(() => buildAuthorizeUrl("state")).toThrow("Discord OAuth belum dikonfigurasi");
    await expect(exchangeCode("code")).rejects.toThrow("Discord OAuth belum dikonfigurasi");

    vi.stubEnv("DISCORD_CLIENT_ID", "client-id");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "client-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(new Response("{}", { status: 200 })),
    );
    await expect(exchangeCode("code")).rejects.toThrow("access token");
    await expect(fetchDiscordProfile("token")).rejects.toThrow(/Profil Discord tidak lengkap/);

    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response("{}", { status: 401 }))
        .mockResolvedValueOnce(new Response("{}", { status: 401 })),
    );
    await expect(exchangeCode("code")).rejects.toThrow("Pertukaran kode Discord gagal");
    await expect(fetchDiscordProfile("token")).rejects.toThrow("Gagal mengambil profil Discord");
  });
});
