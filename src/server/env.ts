import { z } from "zod";

/**
 * Validasi environment saat boot. Aplikasi menolak start bila variabel wajib
 * hilang atau tidak valid (fail fast, lihat docs/ASSUMPTIONS.md).
 */
const boolish = z
  .string()
  .optional()
  .transform((v) => v === "1" || v?.toLowerCase() === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET minimal 32 karakter"),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => {
      try {
        return Buffer.from(v, "base64").length === 32;
      } catch {
        return false;
      }
    }, "ENCRYPTION_KEY harus base64 dari 32 byte (openssl rand -base64 32)"),
  EMAIL_PROVIDER: z.enum(["outbox", "resend", "smtp"]).default("outbox"),
  EMAIL_FROM: z.string().min(3).default("CipiSMP Store <no-reply@cipismp.my.id>"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: boolish,
  PAYMENT_DEFAULT_PROVIDER: z.enum(["TRIPAY", "MIDTRANS", "FAKE"]).default("FAKE"),
  TRIPAY_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  MIDTRANS_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  MINECRAFT_LOOKUP_MODE: z.enum(["mojang", "mock"]).default("mock"),
  PLUGIN_SHARED_SECRET: z.string().min(16).optional(),
  REDIS_URL: z.string().optional(),
  WORKER_ENABLED: boolish,
  TURNSTILE_ENABLED: boolish,
  TURNSTILE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CRON_SECRET: z.string().min(16).optional(),
  SEED_OWNER_EMAIL: z.string().email().optional(),
  SEED_OWNER_USERNAME: z.string().optional(),
  SEED_OWNER_PASSWORD: z.string().optional(),
  // Kredensial gateway boleh kosong (diatur admin lewat UI, disimpan terenkripsi).
  TRIPAY_API_KEY: z.string().optional(),
  TRIPAY_PRIVATE_KEY: z.string().optional(),
  TRIPAY_MERCHANT_CODE: z.string().optional(),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
  FAKE_PROVIDER_MODE: z.enum(["auto", "manual"]).default("auto"),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Konfigurasi environment tidak valid:\n${issues}\n\nLihat .env.example untuk daftar variabel.`);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
