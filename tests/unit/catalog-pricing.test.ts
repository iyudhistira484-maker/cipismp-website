import { describe, expect, it } from "vitest";
import { estimateCatalogPricing } from "@/lib/catalog-pricing";
import { priceCart, type AutomaticDiscountInput, type PriceableProduct } from "@/lib/pricing";

const rank: PriceableProduct = { id: "rank", slug: "rank", name: "Rank", type: "RANK", priceIdr: 100_000, tier: 1, maxPerSeason: 1, cooldownHours: 0, status: "PUBLISHED" };
const kit: PriceableProduct = { ...rank, id: "kit", slug: "kit", name: "Kit", type: "KIT", priceIdr: 40_000 };
const now = new Date("2026-11-01T00:00:00Z");
const promo: AutomaticDiscountInput = { id: "promo", name: "Promo rank", type: "PERCENT", value: 20, minSubtotalIdr: 0, seasonId: "season", startsAt: null, endsAt: null, active: true, rankOnly: true, kitOnly: false, eligibleItemsOnly: true };

describe("perkiraan promo katalog dan keranjang", () => {
  it("menampilkan harga satu produk dengan aturan yang sama seperti checkout", () => {
    const estimate = estimateCatalogPricing([{ product: rank, quantity: 1 }], [promo], "season", now);
    const checkout = priceCart({ items: [{ productId: rank.id, quantity: 1, targetUuid: "player", targetName: "Player" }], catalog: new Map([[rank.id, rank]]), ownedByTarget: new Map(), automaticDiscounts: [promo], seasonId: "season", settings: { taxPercent: 0, feeMode: "absorb", feeFlatIdr: 0, feePercent: 0, seasonFrozen: false }, now });
    expect(estimate).toMatchObject({ subtotalIdr: 100_000, discountIdr: 20_000, totalIdr: 80_000, discountLabel: "Promo rank" });
    expect(estimate.discountIdr).toBe(checkout.discountIdr);
    expect(estimateCatalogPricing([{ product: kit, quantity: 1 }], [promo], "season", now).discountIdr).toBe(0);
  });
  it("menghitung promo campuran sekali di keranjang, dengan minimum total dan basis kategori", () => {
    const items = [{ product: rank, quantity: 1 }, { product: kit, quantity: 1 }];
    const result = estimateCatalogPricing(items, [{ ...promo, minSubtotalIdr: 120_000 }], "season", now);
    expect(result).toMatchObject({ subtotalIdr: 140_000, discountIdr: 20_000, totalIdr: 120_000 });
    expect(estimateCatalogPricing(items.slice(0, 1), [{ ...promo, minSubtotalIdr: 120_000 }], "season", now).discountIdr).toBe(0);
  });
  it("menghormati waktu, status, season dan memilih promo terbesar tanpa menumpuk", () => {
    const items = [{ product: rank, quantity: 1 }];
    expect(estimateCatalogPricing(items, [promo], null, now).discountIdr).toBe(0);
    expect(estimateCatalogPricing(items, [promo], "other", now).discountIdr).toBe(0);
    expect(estimateCatalogPricing(items, [{ ...promo, active: false }], "season", now).discountIdr).toBe(0);
    expect(estimateCatalogPricing(items, [{ ...promo, startsAt: new Date("2027-01-01") }], "season", now).discountIdr).toBe(0);
    expect(estimateCatalogPricing(items, [{ ...promo, endsAt: new Date("2026-01-01") }], "season", now).discountIdr).toBe(0);
    const best = estimateCatalogPricing(items, [promo, { ...promo, id: "fixed", name: "Lebih besar", type: "FIXED", value: 30_000 }], "season", now);
    expect(best).toMatchObject({ discountIdr: 30_000, discountLabel: "Lebih besar", totalIdr: 70_000 });
  });
});
