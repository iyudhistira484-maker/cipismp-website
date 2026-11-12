import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { automaticDiscounts, seasons } from "@/server/db/schema";
import { loadAutomaticDiscounts } from "@/server/discounts";
import { priceCart, type PriceableProduct } from "@/lib/pricing";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix();
const seasonId = `discount_season_${suffix}`;
const discountId = `discount_${suffix}`;
const inactiveId = `discount_inactive_${suffix}`;

describe.skipIf(!databaseUrl())("promo otomatis (database)", () => {
  beforeAll(async () => {
    await db.insert(seasons).values({ id: seasonId, slug: seasonId, name: "Test", startAt: new Date("2025-01-01"), endAt: new Date("2030-01-01"), status: "UPCOMING" });
    await db.insert(automaticDiscounts).values([
      { id: discountId, name: "Promo test", type: "FIXED", value: 15_000, minSubtotalIdr: 20_000, seasonId, rankOnly: true, eligibleItemsOnly: true },
      { id: inactiveId, name: "Nonaktif", type: "PERCENT", value: 99, active: false },
    ]);
  });
  afterAll(async () => {
    await db.delete(automaticDiscounts).where(eq(automaticDiscounts.id, discountId));
    await db.delete(automaticDiscounts).where(eq(automaticDiscounts.id, inactiveId));
    await db.delete(seasons).where(eq(seasons.id, seasonId));
  });
  it("memuat aturan aktif dan menggunakannya untuk menghitung harga", async () => {
    const discounts = await loadAutomaticDiscounts();
    expect(discounts.find((d) => d.id === inactiveId)).toBeUndefined();
    const discount = discounts.find((d) => d.id === discountId);
    expect(discount).toMatchObject({ name: "Promo test", seasonId, rankOnly: true, eligibleItemsOnly: true });
    const product: PriceableProduct = { id: "rank", slug: "rank", name: "Rank", type: "RANK", priceIdr: 50_000, tier: 1, maxPerSeason: 1, cooldownHours: 0, status: "PUBLISHED" };
    const pricing = priceCart({ items: [{ productId: product.id, targetUuid: "player", targetName: "Player" }], catalog: new Map([[product.id, product]]), ownedByTarget: new Map(), automaticDiscounts: discount ? [discount] : [], seasonId, settings: { taxPercent: 0, feeMode: "absorb", feeFlatIdr: 0, feePercent: 0, seasonFrozen: false } });
    expect(pricing).toMatchObject({ ok: true, discountIdr: 15_000, totalIdr: 35_000, discountKind: "AUTOMATIC", couponCode: null });
  });
});
