import { describe, expect, it } from "vitest";
import { productionConfigurationErrors, simulationAllowed } from "@/lib/environment-policy";
import { defaultSettingsForAppEnv, mergeSettings } from "@/server/settings";

const production = {
  appEnv: "production", nodeEnv: "production", minecraftLookupMode: "offline",
  paymentDefaultProvider: "TRIPAY", emailProvider: "smtp",
};

describe("batas simulasi dan default produksi", () => {
  it("menolak simulasi bila salah satu profil menyatakan produksi", () => {
    expect(simulationAllowed("development", "development")).toBe(true);
    expect(simulationAllowed("production", "staging")).toBe(false);
    expect(simulationAllowed("development", "production")).toBe(false);
  });
  it("menolak profil produksi yang tidak aman", () => {
    expect(productionConfigurationErrors(production)).toEqual([]);
    expect(productionConfigurationErrors({ ...production, nodeEnv: "development", minecraftLookupMode: "mock", paymentDefaultProvider: "FAKE", emailProvider: "outbox" })).toHaveLength(4);
    expect(productionConfigurationErrors({ ...production, minecraftLookupMode: "mojang" })).toHaveLength(1);
    expect(productionConfigurationErrors({ ...production, appEnv: "staging", minecraftLookupMode: "mock", emailProvider: "outbox" })).toEqual([]);
  });
  it("menutup checkout dan menonaktifkan gateway pada instalasi produksi baru, tanpa mengubah preview atau data tersimpan", () => {
    const defaults = defaultSettingsForAppEnv("production");
    expect(defaults.store.checkoutEnabled).toBe(false);
    expect(defaults.payments.enabled).toEqual({ TRIPAY: false, MIDTRANS: false, FAKE: false });
    expect(defaults.payments.defaultProvider).toBe("TRIPAY");
    expect(defaultSettingsForAppEnv("development").payments.enabled.FAKE).toBe(true);
    expect(mergeSettings(defaults, { store: { checkoutEnabled: true }, payments: { enabled: { MIDTRANS: true } } }).store.checkoutEnabled).toBe(true);
    expect(mergeSettings(defaults, { payments: { enabled: { MIDTRANS: true } } }).payments.enabled).toEqual({ TRIPAY: false, MIDTRANS: true, FAKE: false });
  });
});
