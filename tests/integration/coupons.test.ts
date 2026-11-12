import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { coupons, seasons } from "@/server/db/schema";
import { loadCouponInput } from "@/server/orders";
import { loadCoupon } from "@/server/pricing-service";
import { priceCart, type PriceableProduct, type PricingSettings } from "@/lib/pricing";
import { databaseUrl, uniqueSuffix } from "./helpers";

const enabled = databaseUrl() !== null;
const suffix = uniqueSuffix();
const seasonId = `season_coupon_${suffix}`;
const couponId = `coupon_tier_${suffix}`;
const couponCode = `TIER-${suffix.toUpperCase()}`;
const settings: PricingSettings = {
  taxPercent: 0,
  feeMode: "absorb",
  feeFlatIdr: 0,
  feePercent: 0,
  seasonFrozen: false,
};

describe.skipIf(!enabled)("kupon bertingkat dan eksklusif season (database)", () => {
  beforeAll(async () => {
    await db.delete(coupons).where(eq(coupons.id, couponId));
    await db.delete(seasons).where(eq(seasons.id, seasonId));
    const now = new Date();
    await db.insert(seasons).values({
      id: seasonId,
      name: `Coupon Season ${suffix}`,
      slug: `coupon-season-${suffix}`,
      startAt: new Date(now.getTime() - 86_400_000),
      endAt: new Date(now.getTime() + 30 * 86_400_000),
      status: "UPCOMING",
      freezeDays: 3,
    });
    await db.insert(coupons).values({
      id: couponId,
      code: couponCode,
      type: "PERCENT",
      value: 10,
      minSubtotalIdr: 25_000,
      tiers: [
        { minSubtotalIdr: 100_000, type: "PERCENT", value: 15 },
        { minSubtotalIdr: 200_000, type: "FIXED", value: 35_000 },
      ],
      seasonId,
      maxPerUser: 1,
      rankOnly: true,
      eligibleItemsOnly: true,
      active: true,
    });
  });

  afterAll(async () => {
    await db.delete(coupons).where(eq(coupons.id, couponId));
    await db.delete(seasons).where(eq(seasons.id, seasonId));
  });

  it("membaca JSONB tier + season dari database dan menerapkan tingkat tertinggi", async () => {
    const loaded = await loadCouponInput(couponCode, "buyer@example.test");
    expect(loaded).toMatchObject({ code: couponCode, seasonId, minSubtotalIdr: 25_000, rankOnly: true, eligibleItemsOnly: true });
    expect(await loadCoupon(couponCode, 0, "buyer@example.test")).toMatchObject({ eligibleItemsOnly: true });
    expect(loaded?.tiers).toEqual([
      { minSubtotalIdr: 100_000, type: "PERCENT", value: 15 },
      { minSubtotalIdr: 200_000, type: "FIXED", value: 35_000 },
    ]);

    const product: PriceableProduct = {
      id: "coupon-test-product",
      slug: "coupon-test-product",
      name: "Rank Coupon Test",
      type: "RANK",
      priceIdr: 250_000,
      tier: 1,
      maxPerSeason: 1,
      cooldownHours: 0,
      status: "PUBLISHED",
    };
    const result = priceCart({
      items: [{ productId: product.id, targetUuid: "11111111-1111-4111-8111-111111111111", targetName: "Tester" }],
      catalog: new Map([[product.id, product]]),
      ownedByTarget: new Map(),
      coupon: loaded,
      seasonId,
      settings,
      now: new Date(),
    });
    expect(result.ok).toBe(true);
    expect(result.discountIdr).toBe(35_000);
    expect(result.totalIdr).toBe(215_000);
  });

  it("pilihan lama tanpa kolom cakupan tetap memakai seluruh keranjang", async () => {
    const legacyId = `${couponId}-legacy`;
    try {
      await db.insert(coupons).values({ id: legacyId, code: `${couponCode}-OLD`, type: "PERCENT", value: 10 });
      const old = await db.query.coupons.findFirst({ where: eq(coupons.id, legacyId) });
      expect(old?.eligibleItemsOnly).toBe(false);
    } finally { await db.delete(coupons).where(eq(coupons.id, legacyId)); }
  });

  it("menolak kupon jika checkout season berbeda dari season eksklusif kupon", async () => {
    const loaded = await loadCouponInput(couponCode, "buyer@example.test");
    const product: PriceableProduct = {
      id: "coupon-test-product",
      slug: "coupon-test-product",
      name: "Rank Coupon Test",
      type: "RANK",
      priceIdr: 50_000,
      tier: 1,
      maxPerSeason: 1,
      cooldownHours: 0,
      status: "PUBLISHED",
    };
    const result = priceCart({
      items: [{ productId: product.id, targetUuid: "11111111-1111-4111-8111-111111111111", targetName: "Tester" }],
      catalog: new Map([[product.id, product]]),
      ownedByTarget: new Map(),
      coupon: loaded,
      seasonId: "season-lain",
      settings,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("COUPON_SEASON_MISMATCH");
    expect(result.discountIdr).toBe(0);
  });
});
