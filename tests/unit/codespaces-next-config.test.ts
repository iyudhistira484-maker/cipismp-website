import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function configure() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("CODESPACES", "true");
  vi.stubEnv("CODESPACE_NAME", "sturdy-space-example");
  vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev");
  vi.stubEnv("APP_URL", "https://sturdy-space-example-3000.app.github.dev");
}

async function config() {
  vi.resetModules();
  return (await import("../../next.config")).default;
}

describe("konfigurasi Next untuk Codespaces", () => {
  it("hanya mengizinkan origin proxy localhost pada preview yang dikonfigurasi tepat", async () => {
    configure();
    const result = await config();
    expect(result.experimental?.serverActions?.allowedOrigins).toEqual(["localhost:3000"]);
    expect(result.allowedDevOrigins).toContain("sturdy-space-example-3000.app.github.dev");
    expect(result.allowedDevOrigins).toContain("*.e2b.app");
  });
  it("tidak mengizinkan pengecualian pada produksi atau profil yang tidak cocok", async () => {
    configure();
    for (const [key, value] of [["NODE_ENV", "production"], ["APP_ENV", "production"], ["CODESPACES", "false"], ["APP_URL", "https://wrong.app.github.dev"]] as const) {
      vi.stubEnv(key, value);
      const result = await config();
      expect(result.experimental?.serverActions?.allowedOrigins).toBeUndefined();
      expect(result.allowedDevOrigins ?? []).not.toContain("sturdy-space-example-3000.app.github.dev");
      configure();
    }
  });
});
