import { eq } from "drizzle-orm";
import { db } from "./db";
import { settings as settingsTable } from "./db/schema";
import { env } from "./env";

/**
 * Pengaturan toko tersimpan di tabel `settings` (satu baris JSON) dan bisa
 * diubah admin tanpa deploy ulang. Default di bawah adalah nilai aman.
 */
export interface StoreSettings {
  site: {
    name: string;
    tagline: string;
    supportEmail: string;
    discordUrl: string;
    announcement: string | null;
  };
  store: {
    taxPercent: number;
    taxLabel: string;
    feeMode: "absorb" | "pass";
    feeFlatIdr: number;
    feePercent: number;
    orderExpiryMinutes: number;
    checkoutEnabled: boolean;
    minimumAge: number;
    defaultFreezeDays: number;
  };
  payments: {
    enabled: { TRIPAY: boolean; MIDTRANS: boolean; FAKE: boolean };
    defaultProvider: "TRIPAY" | "MIDTRANS" | "FAKE";
    tripayMethods: string[];
    midtransMethods: string[];
  };
  delivery: {
    maxAttempts: number;
    baseDelaySeconds: number;
    workerIntervalSeconds: number;
    offlineGraceMinutes: number;
  };
  legal: {
    tosVersion: string;
    privacyVersion: string;
    salesVersion: string;
    updatedAt: string;
  };
  features: {
    coupons: boolean;
    /** Fitur di luar MVP — default mati sampai Wave 2 dikerjakan. */
    gifting: boolean;
    discordLogin: boolean;
    reviews: boolean;
  };
}

export const DEFAULT_SETTINGS: StoreSettings = {
  site: {
    name: "CipiSMP",
    tagline: "Rank dan kit untuk Season 1. Dibuat untuk pemain yang tinggal lama.",
    supportEmail: "bantuan@cipismp.my.id",
    discordUrl: "https://discord.gg/cipismp",
    announcement: null,
  },
  store: {
    taxPercent: 0,
    taxLabel: "PPN",
    feeMode: "absorb",
    feeFlatIdr: 0,
    feePercent: 0,
    orderExpiryMinutes: 30,
    checkoutEnabled: true,
    minimumAge: 13,
    defaultFreezeDays: 3,
  },
  payments: {
    enabled: { TRIPAY: true, MIDTRANS: true, FAKE: true },
    defaultProvider: "FAKE",
    tripayMethods: ["QRIS", "BRIVA", "BNIVA", "GOPAY", "OVO", "DANA", "SHOPEEPAY"],
    midtransMethods: ["qris", "bca_va", "bni_va", "bri_va", "gopay", "shopeepay"],
  },
  delivery: {
    maxAttempts: 6,
    baseDelaySeconds: 60,
    workerIntervalSeconds: 15,
    offlineGraceMinutes: 30,
  },
  legal: {
    tosVersion: "2026-01-01",
    privacyVersion: "2026-01-01",
    salesVersion: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  features: { coupons: true, gifting: true, discordLogin: false, reviews: true },
};

// New production installations start closed and without any active provider.
// Existing saved settings are preserved; this does not alter a live database.
export function defaultSettingsForAppEnv(appEnv: string): StoreSettings {
  if (appEnv !== "production") return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    store: { ...DEFAULT_SETTINGS.store, checkoutEnabled: false },
    payments: { ...DEFAULT_SETTINGS.payments, enabled: { TRIPAY: false, MIDTRANS: false, FAKE: false }, defaultProvider: "TRIPAY" },
  };
}

const SETTINGS_KEY = "store.settings";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function mergeSettings(base: StoreSettings, patch: DeepPartial<StoreSettings>): StoreSettings {
  const out: StoreSettings = { ...base };
  for (const section of Object.keys(base) as (keyof StoreSettings)[]) {
    const patchSection = patch[section];
    if (!patchSection) continue;
    const merged = {
      ...(base[section] as unknown as Record<string, unknown>),
      ...(patchSection as unknown as Record<string, unknown>),
    } as unknown as StoreSettings[typeof section];
    if (section === "payments") {
      const paymentPatch = patch.payments;
      (merged as StoreSettings["payments"]).enabled = {
        ...base.payments.enabled,
        ...(paymentPatch?.enabled ?? {}),
      };
    }
    (out[section] as StoreSettings[typeof section]) = merged;
  }
  return out;
}

let cache: { value: StoreSettings; at: number } | null = null;
const CACHE_TTL_MS = 10_000;

export async function getSettings(): Promise<StoreSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const row = await db.query.settings.findFirst({ where: eq(settingsTable.key, SETTINGS_KEY) });
  const defaults = defaultSettingsForAppEnv(env.APP_ENV);
  const parsed = row ? mergeSettings(defaults, row.value as DeepPartial<StoreSettings>) : defaults;
  cache = { value: parsed, at: Date.now() };
  return parsed;
}

export async function updateSettings(patch: DeepPartial<StoreSettings>, updatedBy: string): Promise<StoreSettings> {
  const current = await getSettings();
  const next = mergeSettings(current, patch);
  await db
    .insert(settingsTable)
    .values({ key: SETTINGS_KEY, value: next, updatedBy })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: next, updatedBy, updatedAt: new Date() } });
  cache = { value: next, at: Date.now() };
  return next;
}

export function invalidateSettingsCache(): void {
  cache = null;
}
