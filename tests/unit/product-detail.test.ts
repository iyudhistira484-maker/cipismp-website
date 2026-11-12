import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/store/add-to-cart", () => ({
  AddToCart: () => createElement("button", null, "Tambah ke keranjang"),
}));
import { PurchaseCard } from "@/components/store/product-detail";

const season = { name: "Season Uji", endAt: new Date("2027-01-14T00:00:00+07:00"), freezeDays: 3 };
const props = { productId: "test", type: "RANK" as const, name: "Rank Uji", payable: 50000, basePayable: 60000, autoDiscountApplied: true, discountLabel: "Promo Uji", season, frozen: false, giftingEnabled: false, checkoutEnabled: true, hasProfile: true };
const render = (overrides: Partial<typeof props> & { blocked?: { code: string; message: string } | null; upgradeFrom?: string | null } = {}) => renderToStaticMarkup(createElement(PurchaseCard, { ...props, ...overrides }));

describe("kartu pembelian produk", () => {
  it("menampilkan harga promo, upgrade dan akhir season", () => {
    const html = render({ upgradeFrom: "Rank Lama" });
    expect(html).toContain("50.000");
    expect(html).toContain("60.000");
    expect(html).toContain("Promo Uji");
    expect(html).toContain("Rank Lama");
    expect(html).toContain("14 Januari 2027");
    expect(html).toContain("Tambah ke keranjang");
  });
  it("tidak menampilkan tombol bila season tiada, dibekukan atau rank diblokir", () => {
    // Override with null despite the non-null default above.
    const noSeason = renderToStaticMarkup(createElement(PurchaseCard, { ...props, season: null, checkoutEnabled: false }));
    expect(noSeason).toContain("Belum ada season aktif");
    expect(noSeason).not.toContain("Tambah ke keranjang");
    expect(noSeason).not.toContain("masih dapat ditambahkan");
    const frozen = render({ frozen: true });
    expect(frozen).toContain("Pembelian ditutup");
    expect(frozen).not.toContain("Tambah ke keranjang");
    const owned = render({ blocked: { code: "RANK_ALREADY_OWNED", message: "Sudah punya rank ini" } });
    expect(owned).toContain("Sudah dimiliki");
    expect(owned).toContain("Sudah punya rank ini");
    expect(owned).not.toContain("Tambah ke keranjang");
  });
});
