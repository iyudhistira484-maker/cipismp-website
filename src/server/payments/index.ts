import { eq } from "drizzle-orm";
import { db } from "../db";
import { paymentCredentials } from "../db/schema";
import { env } from "../env";
import { decryptSecret, encryptSecret } from "../crypto";
import { ids } from "../ids";
import { getSettings } from "../settings";
import { TripayAdapter } from "./tripay";
import { MidtransAdapter } from "./midtrans";
import { FakeAdapter } from "./fake";
import { PaymentProviderError, type PaymentAdapter, type ProviderId } from "./types";

export * from "./types";
export { TripayAdapter } from "./tripay";
export { MidtransAdapter } from "./midtrans";
export { FakeAdapter } from "./fake";

export interface ProviderCredentials {
  TRIPAY?: { apiKey: string; privateKey: string; merchantCode: string };
  MIDTRANS?: { serverKey: string; clientKey: string };
  FAKE?: { secret: string };
}

export interface ProviderRecord {
  provider: ProviderId;
  enabled: boolean;
  mode: "sandbox" | "live";
  config: Record<string, string>;
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  TRIPAY: "Tripay",
  MIDTRANS: "Midtrans",
  FAKE: "Simulasi (dev)",
};

/** Baca konfigurasi gateway: database (terenkripsi) lebih diutamakan daripada env. */
export async function loadProviderConfig(provider: ProviderId): Promise<ProviderRecord | null> {
  const row = await db.query.paymentCredentials.findFirst({
    where: eq(paymentCredentials.provider, provider),
  });
  if (row) {
    const decrypted = decryptSecret(row.configEncrypted);
    return {
      provider,
      enabled: row.enabled,
      mode: row.mode === "live" ? "live" : "sandbox",
      config: decrypted ? (JSON.parse(decrypted) as Record<string, string>) : {},
    };
  }
  if (provider === "TRIPAY" && env.TRIPAY_API_KEY && env.TRIPAY_PRIVATE_KEY && env.TRIPAY_MERCHANT_CODE) {
    return {
      provider,
      enabled: true,
      mode: env.TRIPAY_MODE,
      config: {
        apiKey: env.TRIPAY_API_KEY,
        privateKey: env.TRIPAY_PRIVATE_KEY,
        merchantCode: env.TRIPAY_MERCHANT_CODE,
      },
    };
  }
  if (provider === "MIDTRANS" && env.MIDTRANS_SERVER_KEY) {
    return {
      provider,
      enabled: true,
      mode: env.MIDTRANS_MODE,
      config: { serverKey: env.MIDTRANS_SERVER_KEY, clientKey: env.MIDTRANS_CLIENT_KEY ?? "" },
    };
  }
  if (provider === "FAKE" && env.NODE_ENV !== "production") {
    return { provider, enabled: true, mode: "sandbox", config: { secret: env.SESSION_SECRET } };
  }
  return null;
}

export async function saveProviderConfig(input: {
  provider: ProviderId;
  config: Record<string, string>;
  mode: "sandbox" | "live";
  enabled: boolean;
  updatedBy: string;
}): Promise<void> {
  const encrypted = encryptSecret(JSON.stringify(input.config));
  await db
    .insert(paymentCredentials)
    .values({
      id: ids.payment(),
      provider: input.provider,
      mode: input.mode,
      enabled: input.enabled,
      configEncrypted: encrypted,
      updatedBy: input.updatedBy,
    })
    .onConflictDoUpdate({
      target: paymentCredentials.provider,
      set: {
        mode: input.mode,
        enabled: input.enabled,
        configEncrypted: encrypted,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
    });
}

export class ProviderUnavailableError extends Error {
  constructor(provider: ProviderId) {
    super(`Gateway ${PROVIDER_LABEL[provider]} belum dikonfigurasi atau sedang dinonaktifkan.`);
    this.name = "ProviderUnavailableError";
  }
}

export async function getAdapter(provider: ProviderId): Promise<PaymentAdapter> {
  const record = await loadProviderConfig(provider);
  if (!record || !record.enabled) throw new ProviderUnavailableError(provider);

  if (provider === "TRIPAY") {
    const { apiKey, privateKey, merchantCode } = record.config;
    if (!apiKey || !privateKey || !merchantCode) throw new ProviderUnavailableError("TRIPAY");
    return new TripayAdapter({ apiKey, privateKey, merchantCode }, record.mode);
  }
  if (provider === "MIDTRANS") {
    const { serverKey, clientKey } = record.config;
    if (!serverKey) throw new ProviderUnavailableError("MIDTRANS");
    return new MidtransAdapter({ serverKey, clientKey: clientKey ?? "" }, record.mode);
  }
  const secret = record.config.secret ?? env.SESSION_SECRET;
  return new FakeAdapter(secret);
}

export interface AvailableProvider {
  id: ProviderId;
  label: string;
  mode: "sandbox" | "live";
  methods: Array<{ code: string; label: string; group: string }>;
}

/** Provider yang siap dipakai, mengikuti pengaturan toko + kredensial yang ada. */
export async function getAvailableProviders(): Promise<AvailableProvider[]> {
  const settings = await getSettings();
  const out: AvailableProvider[] = [];
  for (const id of ["TRIPAY", "MIDTRANS", "FAKE"] as ProviderId[]) {
    if (!settings.payments.enabled[id]) continue;
    if (id === "FAKE" && env.NODE_ENV === "production") continue;
    try {
      const adapter = await getAdapter(id);
      out.push({ id, label: PROVIDER_LABEL[id], mode: adapter.mode, methods: await adapter.availableMethods() });
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) throw error;
    }
  }
  return out;
}

/** Default provider: pengaturan admin bila tersedia, jika tidak provider pertama. */
export async function defaultProvider(available: AvailableProvider[]): Promise<ProviderId | null> {
  const settings = await getSettings();
  if (available.some((p) => p.id === settings.payments.defaultProvider)) return settings.payments.defaultProvider;
  return available[0]?.id ?? null;
}

export { PaymentProviderError };
