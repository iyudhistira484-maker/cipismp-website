import { afterEach, vi } from "vitest";

// Env minimum untuk modul server yang membaca process.env saat import.
const env = process.env as Record<string, string>;
// Integration test hanya berjalan bila database test diberikan secara eksplisit.
const providedTestDb = env.TEST_DATABASE_URL ?? env.DATABASE_URL ?? "";
env.NODE_ENV ??= "test";
env.DATABASE_URL ??= providedTestDb || "postgres://postgres@localhost:5432/cipismp_test";
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef0123456789";
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.APP_URL ??= "http://localhost:3000";
process.env.PLUGIN_SHARED_SECRET ??= "test-plugin-secret-0123456789abcdef";
process.env.TURNSTILE_ENABLED ??= "0";
env.EMAIL_PROVIDER ??= "outbox";
env.MINECRAFT_LOOKUP_MODE ??= "mock";
env.TEST_DB = providedTestDb;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
