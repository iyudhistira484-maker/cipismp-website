import { describe, expect, it, vi } from "vitest";

const { findFirst, env } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  env: { NODE_ENV: "production", APP_ENV: "production", SESSION_SECRET: "unused", ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" },
}));
vi.mock("@/server/env", () => ({ env }));
vi.mock("@/server/db", () => ({ db: { query: { paymentCredentials: { findFirst } } } }));

import { getAdapter, loadProviderConfig, saveProviderConfig, ProviderUnavailableError } from "@/server/payments";
import { POST as fakePay } from "@/app/api/fake/pay/route";
import { POST as fakeWebhook } from "@/app/api/webhooks/fake/route";

describe("gateway simulasi di produksi", () => {
  it("menolak kredensial FAKE tersimpan tanpa membaca database atau membuat adapter", async () => {
    findFirst.mockResolvedValue({ enabled: true, mode: "live", configEncrypted: "stored" });
    expect(await loadProviderConfig("FAKE")).toBeNull();
    await expect(getAdapter("FAKE")).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("menolak penyimpanan kredensial FAKE dan endpoint bayar simulasi", async () => {
    await expect(saveProviderConfig({ provider: "FAKE", config: { secret: "irrelevant" }, enabled: true, mode: "sandbox", updatedBy: "owner" })).rejects.toThrow("tidak tersedia");
    expect((await fakePay(new Request("http://localhost/api/fake/pay", { method: "POST" }))).status).toBe(404);
    vi.stubEnv("APP_ENV", "production");
    expect((await fakeWebhook(new Request("http://localhost/api/webhooks/fake", { method: "POST" }))).status).toBe(404);
    vi.unstubAllEnvs();
  });
});
