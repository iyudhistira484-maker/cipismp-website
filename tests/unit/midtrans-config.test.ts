import { describe, expect, it } from "vitest";
import { resolveMidtransSignatureSecret } from "@/server/payments/midtrans-config";

describe("Signature Secret Key Midtrans", () => {
  const existing = { mode: "sandbox" as const, config: { signatureSecretKey: "stored-secret" } };
  it("menyimpan secret baru dan mempertahankan yang lama hanya pada mode yang sama", () => {
    expect(resolveMidtransSignatureSecret("  new-secret  ", "sandbox", existing)).toBe("new-secret");
    expect(resolveMidtransSignatureSecret("", "sandbox", existing)).toBe("stored-secret");
    expect(resolveMidtransSignatureSecret("", "live", existing)).toBe("");
    expect(resolveMidtransSignatureSecret("live-secret", "live", existing)).toBe("live-secret");
    expect(resolveMidtransSignatureSecret("", "sandbox", null)).toBe("");
  });
});
