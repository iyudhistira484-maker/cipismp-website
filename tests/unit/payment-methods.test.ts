import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "@/server/settings";
import {
  FAKE_METHODS,
  MIDTRANS_METHODS,
  TRIPAY_METHODS,
  filterPaymentMethods,
} from "@/lib/payment-methods";

describe("pengaturan metode pembayaran", () => {
  it("mempertahankan flag gateway lain saat satu flag diperbarui", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { payments: { enabled: { TRIPAY: false } } });

    expect(merged.payments.enabled).toEqual({ TRIPAY: false, MIDTRANS: true, FAKE: true });
    expect(merged.payments.tripayMethods).toEqual(DEFAULT_SETTINGS.payments.tripayMethods);
    expect(merged.payments.midtransMethods).toEqual(DEFAULT_SETTINGS.payments.midtransMethods);
  });

  it("mengisi nilai default metode untuk data settings lama yang belum punya array metode", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, {
      payments: {
        defaultProvider: "MIDTRANS",
        enabled: { TRIPAY: false, MIDTRANS: true, FAKE: false },
      },
    });

    expect(merged.payments.defaultProvider).toBe("MIDTRANS");
    expect(merged.payments.tripayMethods).toEqual(DEFAULT_SETTINGS.payments.tripayMethods);
    expect(merged.payments.midtransMethods).toEqual(DEFAULT_SETTINGS.payments.midtransMethods);
  });

  it("hanya menawarkan metode terpilih yang masih dikenal oleh provider", () => {
    expect(filterPaymentMethods(TRIPAY_METHODS, ["QRIS", "BSIVA", "UNKNOWN"]).map((method) => method.code)).toEqual([
      "QRIS",
      "BSIVA",
    ]);
    expect(filterPaymentMethods(MIDTRANS_METHODS, []).map((method) => method.code)).toEqual([]);
    expect(FAKE_METHODS.map((method) => method.code)).toEqual(["QRIS", "VA"]);
  });
});
