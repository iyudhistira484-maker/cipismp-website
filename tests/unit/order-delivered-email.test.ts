import { describe, expect, it } from "vitest";
import { orderDeliveredTemplate } from "@/server/email/templates";

describe("email pengiriman tercatat selesai", () => {
  it("meminta pemeriksaan akses tanpa menganggap DELIVERED membuktikan klaim", () => {
    const email = orderDeliveredTemplate({
      orderNumber: "CIPS-TEST",
      playerName: "Player",
      seasonName: "Season 1",
      seasonEndsAt: new Date("2027-01-14T00:00:00Z"),
      subtotalIdr: 35000,
      discountIdr: 0,
      discountLabel: null,
      totalIdr: 35000,
      items: [{ name: "CipiPrime", type: "KIT", amountIdr: 35000 }],
      statusUrl: "https://example.test/pesanan/test",
    });
    expect(email.html).toContain("pengiriman order");
    expect(email.html).toContain("PlayerKits2");
    expect(email.text).toContain("Periksa akses di server");
    expect(email.text).not.toContain("akses diaktifkan");
  });
});
