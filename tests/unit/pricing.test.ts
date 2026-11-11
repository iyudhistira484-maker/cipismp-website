import { describe, expect, it } from "vitest";
import {
  couponDiscount,
  personalRankPrice,
  priceCart,
  type CouponInput,
  type OwnedEntitlement,
  type PriceableProduct,
  type PricingSettings,
} from "@/lib/pricing";

const NOW = new Date("2025-03-10T10:00:00.000Z");

const settings: PricingSettings = {
  taxPercent: 0,
  feeMode: "absorb",
  feeFlatIdr: 0,
  feePercent: 0,
  seasonFrozen: false,
};

function rank(id: string, tier: number, priceIdr: number): PriceableProduct {
  return {
    id,
    slug: id,
    name: `Rank ${id}`,
    type: "RANK",
    priceIdr,
    tier,
    maxPerSeason: 1,
    cooldownHours: 0,
    status: "PUBLISHED",
    deletedAt: null,
  };
}

function kit(id: string, priceIdr: number, maxPerSeason = 1, cooldownHours = 0): PriceableProduct {
  return {
    id,
    slug: id,
    name: `Kit ${id}`,
    type: "KIT",
    priceIdr,
    tier: 0,
    maxPerSeason,
    cooldownHours,
    status: "PUBLISHED",
    deletedAt: null,
  };
}

function owned(product: PriceableProduct, overrides: Partial<OwnedEntitlement> = {}): OwnedEntitlement {
  return {
    productId: product.id,
    productName: product.name,
    productType: product.type,
    tier: product.tier,
    productPriceIdr: product.priceIdr,
    active: true,
    createdAt: new Date("2025-03-01T00:00:00.000Z"),
    ...overrides,
  };
}

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function cart(product: PriceableProduct, targetUuid = UUID_A, quantity = 1) {
  return { productId: product.id, quantity, targetUuid, targetName: "Cipi" };
}

describe("priceCart — aturan rank", () => {
  it("menagih harga penuh untuk rank baru", () => {
    const vip = rank("vip", 1, 25_000);
    const result = priceCart({
      items: [cart(vip)],
      catalog: new Map([[vip.id, vip]]),
      ownedByTarget: new Map(),
      settings,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.lines[0]!.unitPriceIdr).toBe(25_000);
    expect(result.lines[0]!.upgradeFrom).toBeNull();
    expect(result.totalIdr).toBe(25_000);
  });

  it("memblokir pembelian ulang rank yang sudah dimiliki", () => {
    const vip = rank("vip", 1, 25_000);
    const result = priceCart({
      items: [cart(vip)],
      catalog: new Map([[vip.id, vip]]),
      ownedByTarget: new Map([[UUID_A, [owned(vip)]]]),
      settings,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("RANK_ALREADY_OWNED");
    expect(result.lines).toHaveLength(0);
  });

  it("upgrade hanya menagih selisih harga", () => {
    const vip = rank("vip", 1, 25_000);
    const mvp = rank("mvp", 2, 60_000);
    const result = priceCart({
      items: [cart(mvp)],
      catalog: new Map([
        [vip.id, vip],
        [mvp.id, mvp],
      ]),
      ownedByTarget: new Map([[UUID_A, [owned(vip)]]]),
      settings,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.lines[0]!.unitPriceIdr).toBe(35_000);
    expect(result.lines[0]!.listPriceIdr).toBe(60_000);
    expect(result.lines[0]!.upgradeFrom?.name).toBe("Rank vip");
    expect(result.totalIdr).toBe(35_000);
  });

  it("upgrade memakai rank tertinggi yang dimiliki, bukan urutan entitlement", () => {
    const vip = rank("vip", 1, 25_000);
    const mvp = rank("mvp", 2, 60_000);
    const legend = rank("legend", 3, 100_000);
    const result = priceCart({
      items: [cart(legend)],
      catalog: new Map([
        [vip.id, vip],
        [mvp.id, mvp],
        [legend.id, legend],
      ]),
      ownedByTarget: new Map([[UUID_A, [owned(vip), owned(mvp)]]]),
      settings,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.lines[0]!.unitPriceIdr).toBe(40_000);
  });

  it("memblokir downgrade", () => {
    const vip = rank("vip", 1, 25_000);
    const mvp = rank("mvp", 2, 60_000);
    const result = priceCart({
      items: [cart(vip)],
      catalog: new Map([
        [vip.id, vip],
        [mvp.id, mvp],
      ]),
      ownedByTarget: new Map([[UUID_A, [owned(mvp)]]]),
      settings,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("RANK_DOWNGRADE");
  });

  it("mengabaikan entitlement yang tidak aktif (season lalu)", () => {
    const mvp = rank("mvp", 2, 60_000);
    const result = priceCart({
      items: [cart(mvp)],
      catalog: new Map([[mvp.id, mvp]]),
      ownedByTarget: new Map([[UUID_A, [owned(mvp, { active: false })]]]),
      settings,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.totalIdr).toBe(60_000);
  });

  it("memaksa satu rank per transaksi", () => {
    const vip = rank("vip", 1, 25_000);
    const mvp = rank("mvp", 2, 60_000);
    const result = priceCart({
      items: [cart(vip), cart(mvp)],
      catalog: new Map([
        [vip.id, vip],
        [mvp.id, mvp],
      ]),
      ownedByTarget: new Map(),
      settings,
      now: NOW,
    });
    expect(result.errors.map((e) => e.code)).toContain("RANK_ONE_PER_ORDER");
  });

  it("gift: aturan rank dievaluasi terhadap UUID penerima", () => {
    const mvp = rank("mvp", 2, 60_000);
    const ownVipOnA = owned(rank("vip", 1, 25_000));
    // Pembeli punya VIP, penerima tidak punya rank -> harga penuh untuk penerima.
    const toB = priceCart({
      items: [cart(mvp, UUID_B)],
      catalog: new Map([[mvp.id, mvp]]),
      ownedByTarget: new Map([[UUID_A, [ownVipOnA]]]),
      settings,
      now: NOW,
    });
    expect(toB.ok).toBe(true);
    expect(toB.lines[0]!.unitPriceIdr).toBe(60_000);

    // Penerima sudah punya MVP -> diblokir walau pembeli bukan pemiliknya.
    const recipientOwns = priceCart({
      items: [cart(mvp, UUID_B)],
      catalog: new Map([[mvp.id, mvp]]),
      ownedByTarget: new Map([[UUID_B, [owned(mvp)]]]),
      settings,
      now: NOW,
    });
    expect(recipientOwns.ok).toBe(false);
    expect(recipientOwns.errors.map((e) => e.code)).toContain("RANK_ALREADY_OWNED");
  });

  it("memblokir pembelian saat purchase freeze season aktif", () => {
    const vip = rank("vip", 1, 25_000);
    const result = priceCart({
      items: [cart(vip)],
      catalog: new Map([[vip.id, vip]]),
      ownedByTarget: new Map(),
      settings: { ...settings, seasonFrozen: true },
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("SEASON_FROZEN");
  });
});

describe("priceCart — kit", () => {
  it("menghormati maxPerSeason", () => {
    const diamond = kit("diamond-kit", 15_000, 2);
    const second = priceCart({
      items: [cart(diamond)],
      catalog: new Map([[diamond.id, diamond]]),
      ownedByTarget: new Map([[UUID_A, [owned(diamond)]]]),
      settings,
      now: NOW,
    });
    expect(second.ok).toBe(true);
    expect(second.totalIdr).toBe(15_000);

    const third = priceCart({
      items: [cart(diamond)],
      catalog: new Map([[diamond.id, diamond]]),
      ownedByTarget: new Map([[UUID_A, [owned(diamond), owned(diamond)]]]),
      settings,
      now: NOW,
    });
    expect(third.ok).toBe(false);
    expect(third.errors.map((e) => e.code)).toContain("KIT_LIMIT_REACHED");
  });

  it("menghormati cooldown sejak pembelian terakhir", () => {
    const nether = kit("nether-kit", 20_000, 3, 24);
    const recent = priceCart({
      items: [cart(nether)],
      catalog: new Map([[nether.id, nether]]),
      ownedByTarget: new Map([[UUID_A, [owned(nether, { createdAt: new Date("2025-03-10T05:00:00.000Z") })]]]),
      settings,
      now: NOW,
    });
    expect(recent.errors.map((e) => e.code)).toContain("KIT_COOLDOWN");

    const cooled = priceCart({
      items: [cart(nether)],
      catalog: new Map([[nether.id, nether]]),
      ownedByTarget: new Map([[UUID_A, [owned(nether, { createdAt: new Date("2025-03-08T00:00:00.000Z") })]]]),
      settings,
      now: NOW,
    });
    expect(cooled.ok).toBe(true);
  });

  it("menghitung kuantitas kit", () => {
    const food = kit("food-kit", 5_000, 5);
    const result = priceCart({
      items: [cart(food, UUID_A, 3)],
      catalog: new Map([[food.id, food]]),
      ownedByTarget: new Map(),
      settings,
      now: NOW,
    });
    expect(result.lines[0]!.lineTotalIdr).toBe(15_000);
  });

  it("menolak kuantitas tidak valid", () => {
    const food = kit("food-kit", 5_000, 5);
    const result = priceCart({
      items: [cart(food, UUID_A, 0)],
      catalog: new Map([[food.id, food]]),
      ownedByTarget: new Map(),
      settings,
      now: NOW,
    });
    expect(result.errors.map((e) => e.code)).toContain("INVALID_QUANTITY");
  });
});

describe("priceCart — validasi keranjang", () => {
  it("menolak produk yang tidak published atau terhapus", () => {
    const draft = { ...rank("draft", 1, 10_000), status: "DRAFT" as const };
    const deleted = { ...rank("gone", 1, 10_000), deletedAt: new Date() };
    const result = priceCart({
      items: [cart(draft), cart(deleted)],
      catalog: new Map<string, PriceableProduct>([
        [draft.id, draft],
        [deleted.id, deleted],
      ]),
      ownedByTarget: new Map(),
      settings,
      now: NOW,
    });
    expect(result.errors.filter((e) => e.code === "PRODUCT_UNAVAILABLE")).toHaveLength(2);
  });

  it("menolak item tanpa UUID penerima", () => {
    const vip = rank("vip", 1, 25_000);
    const result = priceCart({
      items: [{ productId: vip.id, targetUuid: "", targetName: "" }],
      catalog: new Map([[vip.id, vip]]),
      ownedByTarget: new Map(),
      settings,
      now: NOW,
    });
    expect(result.errors.map((e) => e.code)).toContain("MISSING_TARGET");
  });

  it("menandai keranjang kosong", () => {
    const result = priceCart({
      items: [],
      catalog: new Map(),
      ownedByTarget: new Map(),
      settings,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("EMPTY_CART");
    expect(result.totalIdr).toBe(0);
  });

  it("menghapus duplikat produk+penerima", () => {
    const vip = rank("vip", 1, 25_000);
    const result = priceCart({
      items: [cart(vip), cart(vip)],
      catalog: new Map([[vip.id, vip]]),
      ownedByTarget: new Map(),
      settings,
      now: NOW,
    });
    expect(result.lines).toHaveLength(1);
    expect(result.totalIdr).toBe(25_000);
  });
});

function coupon(overrides: Partial<CouponInput> = {}): CouponInput {
  return {
    code: "HEMAT10",
    type: "PERCENT",
    value: 10,
    minSubtotalIdr: 0,
    maxRedemptions: null,
    maxPerUser: 1,
    startsAt: null,
    endsAt: null,
    active: true,
    rankOnly: false,
    kitOnly: false,
    redemptionsTotal: 0,
    redemptionsByBuyer: 0,
    ...overrides,
  };
}

describe("priceCart — kupon, pajak, biaya", () => {
  const vip = rank("vip", 1, 100_000);
  const base = {
    items: [cart(vip)],
    catalog: new Map([[vip.id, vip]]),
    ownedByTarget: new Map(),
  };

  it("menerapkan diskon persen", () => {
    const result = priceCart({ ...base, coupon: coupon(), settings, now: NOW });
    expect(result.ok).toBe(true);
    expect(result.discountIdr).toBe(10_000);
    expect(result.totalIdr).toBe(90_000);
    expect(result.couponCode).toBe("HEMAT10");
  });

  it("diskon tetap tidak pernah melebihi subtotal atau negatif", () => {
    const result = priceCart({
      ...base,
      coupon: coupon({ type: "FIXED", value: 500_000 }),
      settings,
      now: NOW,
    });
    expect(result.discountIdr).toBe(100_000);
    expect(result.totalIdr).toBe(0);
    expect(couponDiscount(coupon({ type: "FIXED", value: 500_000 }), 100_000)).toBe(100_000);
  });

  it("menolak kupon kedaluwarsa dan yang belum mulai", () => {
    const expired = priceCart({
      ...base,
      coupon: coupon({ endsAt: new Date("2025-03-09T00:00:00.000Z") }),
      settings,
      now: NOW,
    });
    expect(expired.errors.map((e) => e.code)).toContain("COUPON_EXPIRED");
    expect(expired.discountIdr).toBe(0);

    const notStarted = priceCart({
      ...base,
      coupon: coupon({ startsAt: new Date("2025-03-11T00:00:00.000Z") }),
      settings,
      now: NOW,
    });
    expect(notStarted.errors.map((e) => e.code)).toContain("COUPON_NOT_STARTED");
  });

  it("menolak kupon habis kuota dan batas per pembeli", () => {
    const exhausted = priceCart({
      ...base,
      coupon: coupon({ maxRedemptions: 5, redemptionsTotal: 5 }),
      settings,
      now: NOW,
    });
    expect(exhausted.errors.map((e) => e.code)).toContain("COUPON_LIMIT_REACHED");

    const perUser = priceCart({
      ...base,
      coupon: coupon({ maxPerUser: 1, redemptionsByBuyer: 1 }),
      settings,
      now: NOW,
    });
    expect(perUser.errors.map((e) => e.code)).toContain("COUPON_PER_USER_LIMIT");
  });

  it("menolak kupon di bawah subtotal minimum", () => {
    const result = priceCart({
      ...base,
      coupon: coupon({ minSubtotalIdr: 200_000 }),
      settings,
      now: NOW,
    });
    expect(result.errors.map((e) => e.code)).toContain("COUPON_MIN_SUBTOTAL");
  });

  it("menolak kupon yang tidak cocok jenis produk", () => {
    const kitOnly = priceCart({ ...base, coupon: coupon({ kitOnly: true }), settings, now: NOW });
    expect(kitOnly.errors.map((e) => e.code)).toContain("COUPON_TYPE_MISMATCH");
  });

  it("menghitung pajak PPN setelah diskon", () => {
    const result = priceCart({
      ...base,
      coupon: coupon(),
      settings: { ...settings, taxPercent: 11 },
      now: NOW,
    });
    expect(result.taxIdr).toBe(9_900); // 11% x 90.000
    expect(result.totalIdr).toBe(99_900);
  });

  it("menambahkan biaya gateway hanya saat feeMode pass", () => {
    const absorbed = priceCart({
      ...base,
      settings: { ...settings, feeMode: "absorb", feeFlatIdr: 4_000, feePercent: 2 },
      now: NOW,
    });
    expect(absorbed.feeIdr).toBe(0);

    const passed = priceCart({
      ...base,
      settings: { ...settings, feeMode: "pass", feeFlatIdr: 4_000, feePercent: 2 },
      now: NOW,
    });
    expect(passed.feeIdr).toBe(6_000); // 4.000 + 2% x 100.000
    expect(passed.totalIdr).toBe(106_000);
  });
});

describe("personalRankPrice", () => {
  const vip = rank("vip", 1, 25_000);
  const mvp = rank("mvp", 2, 60_000);

  it("harga penuh untuk rank baru", () => {
    expect(personalRankPrice(mvp, null)).toEqual({ payableIdr: 60_000, blocked: null, savedIdr: 0 });
  });

  it("menampilkan selisih untuk upgrade", () => {
    expect(personalRankPrice(mvp, owned(vip))).toEqual({
      payableIdr: 35_000,
      blocked: null,
      savedIdr: 25_000,
    });
  });

  it("menandai already owned dan downgrade", () => {
    expect(personalRankPrice(vip, owned(vip)).blocked).toBe("ALREADY_OWNED");
    expect(personalRankPrice(vip, owned(mvp)).blocked).toBe("DOWNGRADE");
  });
});
