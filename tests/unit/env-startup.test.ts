import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function load(overrides: Record<string, string | undefined>) {
  const env = {
    ...process.env,
    NODE_ENV: "production", APP_ENV: "production", APP_URL: "https://example.test",
    DATABASE_URL: "postgres://localhost/test", SESSION_SECRET: "test-secret-0123456789abcdef0123456789",
    ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", EMAIL_PROVIDER: "smtp",
    PAYMENT_DEFAULT_PROVIDER: "TRIPAY", MINECRAFT_LOOKUP_MODE: "offline", ...overrides,
  } as NodeJS.ProcessEnv;
  return spawnSync(process.execPath, ["--import", "tsx", "-e", 'require("./src/server/env.ts");'], { cwd: process.cwd(), env, encoding: "utf8" });
}

describe("validasi environment runtime", () => {
  it("menerima profil produksi yang eksplisit dan menolak simulasi", () => {
    expect(load({}).status).toBe(0);
    for (const overrides of [
      { APP_ENV: undefined },
      { MINECRAFT_LOOKUP_MODE: "mock" },
      { EMAIL_PROVIDER: "outbox" },
      { PAYMENT_DEFAULT_PROVIDER: "FAKE" },
      { NODE_ENV: "development" },
    ]) {
      const result = load(overrides);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/APP_ENV|Konfigurasi produksi tidak aman/);
    }
  });
});
