import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const state: { row: any } = { row: undefined };
  const env = {
    NODE_ENV: "production", APP_ENV: "production", SESSION_SECRET: "unused",
    ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    MIDTRANS_MODE: "sandbox", MIDTRANS_SERVER_KEY: "", MIDTRANS_CLIENT_KEY: "", MIDTRANS_SIGNATURE_SECRET_KEY: "",
  };
  return { state, env };
});
vi.mock("@/server/env", () => ({ env: mock.env }));
vi.mock("@/server/settings", () => ({ getSettings: async () => ({ payments: { enabled: { MIDTRANS: true }, midtransMethods: ["qris"] } }) }));
vi.mock("@/server/db", () => ({
  db: {
    query: { paymentCredentials: { findFirst: async () => mock.state.row } },
    insert: () => ({ values: (row: any) => ({ onConflictDoUpdate: async () => { mock.state.row = row; } }) }),
  },
}));

import { decryptSecret, encryptSecret } from "@/server/crypto";
import { getAdapter, getAvailableProviders, loadProviderConfig, ProviderUnavailableError, saveProviderConfig } from "@/server/payments";

const record = { provider: "MIDTRANS" as const, mode: "sandbox" as const, enabled: true, updatedBy: "owner" };

describe("penyimpanan dan kesiapan Midtrans", () => {
  beforeEach(() => {
    mock.state.row = undefined;
    mock.env.MIDTRANS_SERVER_KEY = "";
    mock.env.MIDTRANS_SIGNATURE_SECRET_KEY = "";
  });
  it("konfigurasi lama tanpa signature secret tidak siap dan tidak membuat adapter", async () => {
    mock.state.row = { enabled: true, mode: "sandbox", configEncrypted: encryptSecret(JSON.stringify({ serverKey: "old-server-key" })) };
    await expect(getAdapter("MIDTRANS")).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(await getAvailableProviders()).toEqual([]);
    await expect(saveProviderConfig({ ...record, config: { serverKey: "old-server-key" } })).rejects.toThrow("Signature Secret Key");
  });
  it("menyimpan key terenkripsi, memuat adapter, dan memungkinkan dinonaktifkan", async () => {
    const config = { serverKey: "server-key", clientKey: "client-key", signatureSecretKey: "different-secret-key" };
    await saveProviderConfig({ ...record, config });
    expect(mock.state.row.configEncrypted).not.toContain(config.signatureSecretKey);
    expect(JSON.parse(decryptSecret(mock.state.row.configEncrypted)!)).toEqual(config);
    expect((await loadProviderConfig("MIDTRANS"))?.config).toEqual(config);
    expect((await getAdapter("MIDTRANS")).id).toBe("MIDTRANS");
    expect(await getAvailableProviders()).toHaveLength(1);
    await saveProviderConfig({ ...record, config, enabled: false });
    await expect(getAdapter("MIDTRANS")).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
  it("membaca secret dari env hanya jika tidak ada konfigurasi tersimpan", async () => {
    mock.env.MIDTRANS_SERVER_KEY = "env-server";
    await expect(getAdapter("MIDTRANS")).rejects.toBeInstanceOf(ProviderUnavailableError);
    mock.env.MIDTRANS_SIGNATURE_SECRET_KEY = "env-signature";
    expect((await getAdapter("MIDTRANS")).id).toBe("MIDTRANS");
    mock.state.row = { enabled: true, mode: "sandbox", configEncrypted: encryptSecret(JSON.stringify({ serverKey: "db-server" })) };
    await expect(getAdapter("MIDTRANS")).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});
