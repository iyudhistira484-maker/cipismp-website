import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Cloudflare Turnstile siteverify contract", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_ENABLED", "1");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-turnstile-secret");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("mengirim secret, token, dan IP; menerima success=true", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: true, hostname: "cipismp.test" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { verifyTurnstile } = await import("@/server/auth/turnstile");

    await expect(verifyTurnstile("turnstile-response-token", "203.0.113.8")).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
    const body = new URLSearchParams(init?.body as URLSearchParams);
    expect(body.get("secret")).toBe("test-turnstile-secret");
    expect(body.get("response")).toBe("turnstile-response-token");
    expect(body.get("remoteip")).toBe("203.0.113.8");
  });

  it("gagal tertutup bila token/secret kosong, provider menolak, atau jaringan error", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const { verifyTurnstile } = await import("@/server/auth/turnstile");

    await expect(verifyTurnstile(undefined, "203.0.113.8")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] })));
    await expect(verifyTurnstile("bad-token", "203.0.113.8")).resolves.toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(verifyTurnstile("token", "203.0.113.8")).resolves.toBe(false);

    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.resetModules();
    const withoutSecret = await import("@/server/auth/turnstile");
    await expect(withoutSecret.verifyTurnstile("token", "203.0.113.8")).resolves.toBe(false);
  });

  it("tetap lolos jika Turnstile dinonaktifkan di lingkungan dev/test", async () => {
    vi.stubEnv("TURNSTILE_ENABLED", "0");
    vi.resetModules();
    const { verifyTurnstile } = await import("@/server/auth/turnstile");
    await expect(verifyTurnstile(undefined, "127.0.0.1")).resolves.toBe(true);
  });
});
