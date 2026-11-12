import { afterEach, vi } from "vitest";

// Env minimum untuk modul server yang membaca process.env saat import.
const env = process.env as Record<string, string>;
// Integration test hanya berjalan bila database test diberikan secara eksplisit.
// Setup dijalankan ulang per berkas test, jadi keputusan ini disimpan sekali saja
// (kalau tidak, fallback DATABASE_URL akan terbaca sebagai database test).
const explicitTestDb = env.TEST_DATABASE_URL ?? env.DATABASE_URL ?? "";
env.NODE_ENV ??= "test";
env.DATABASE_URL ??= explicitTestDb || "postgres://postgres@localhost:5432/cipismp_test";
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef0123456789";
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.APP_URL ??= "http://localhost:3000";
process.env.PLUGIN_SHARED_SECRET ??= "test-plugin-secret-0123456789abcdef";
process.env.TURNSTILE_ENABLED ??= "0";
process.env.CRON_SECRET ??= "test-cron-secret-0123456789";
env.EMAIL_PROVIDER ??= "outbox";
env.MINECRAFT_LOOKUP_MODE ??= "mock";
env.TEST_DB ??= explicitTestDb;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
