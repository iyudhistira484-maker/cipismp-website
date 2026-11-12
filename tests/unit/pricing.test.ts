import { describe, expect, it } from "vitest";
import {
  couponDiscount,
  personalRankPrice,
  priceCart,
  type AutomaticDiscountInput,
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

describe("priceCart — batas jumlah", () => {
  it("menolak beberapa unit kit yang hanya menghasilkan satu entitlement", () => {
    const item = kit("prime", 35_000, 1);
    const result = priceCart({ items: [cart(item, UUID_A, 2)], catalog: new Map([[item.id, item]]), ownedByTarget: new Map(), settings });
    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("INVALID_QUANTITY");
  });
});

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

  it("menghitung satu unit kit sesuai fulfillment", () => {
    const food = kit("food-kit", 5_000, 5);
    const result = priceCart({
      items: [cart(food, UUID_A, 1)],
      catalog: new Map([[food.id, food]]),
      ownedByTarget: new Map(),
      settings,
      now: NOW,
    });
    expect(result.lines[0]!.lineTotalIdr).toBe(5_000);
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
    tiers: [],
    seasonId: null,
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

  it("memilih tingkat diskon tertinggi yang tercapai tanpa menumpuk diskon", () => {
    const multiTier = coupon({
      minSubtotalIdr: 50_000,
      value: 10,
      tiers: [
        { minSubtotalIdr: 100_000, type: "PERCENT", value: 15 },
        { minSubtotalIdr: 200_000, type: "PERCENT", value: 20 },
      ],
    });
    const priceAt = (amount: number) => {
      const product = rank(`tier-${amount}`, 1, amount);
      return priceCart({
        items: [cart(product)],
        catalog: new Map([[product.id, product]]),
        ownedByTarget: new Map(),
        coupon: multiTier,
        settings,
        now: NOW,
      });
    };

    expect(priceAt(99_999).discountIdr).toBe(10_000); // tier dasar 10%
    expect(priceAt(100_000).discountIdr).toBe(15_000); // ambang inklusif
    expect(priceAt(150_000).discountIdr).toBe(22_500);
    expect(priceAt(250_000).discountIdr).toBe(50_000); // 20%, bukan 10% + 15% + 20%
  });

  it("memilih tipe diskon baru untuk tier nominal", () => {
    const product = rank("fixed-tier", 1, 150_000);
    const result = priceCart({
      items: [cart(product)],
      catalog: new Map([[product.id, product]]),
      ownedByTarget: new Map(),
      coupon: coupon({
        minSubtotalIdr: 50_000,
        value: 10,
        tiers: [{ minSubtotalIdr: 100_000, type: "FIXED", value: 30_000 }],
      }),
      settings,
      now: NOW,
    });
    expect(result.discountIdr).toBe(30_000);
    expect(result.totalIdr).toBe(120_000);
  });

  it("membatasi kupon season-eksklusif ke season yang sama", () => {
    const seasonal = coupon({ seasonId: "season-2026" });
    const product = rank("seasonal-coupon", 1, 100_000);
    const args = {
      items: [cart(product)],
      catalog: new Map([[product.id, product]]),
      ownedByTarget: new Map(),
      coupon: seasonal,
      settings,
      now: NOW,
    };
    expect(priceCart({ ...args, seasonId: "season-2026" }).ok).toBe(true);
    for (const seasonId of ["season-2027", null]) {
      const result = priceCart({ ...args, seasonId });
      expect(result.errors.map((error) => error.code)).toContain("COUPON_SEASON_MISMATCH");
      expect(result.discountIdr).toBe(0);
    }
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

function automatic(overrides: Partial<AutomaticDiscountInput> = {}): AutomaticDiscountInput {
  return {
    id: "auto-1", name: "Promo", type: "PERCENT", value: 20, minSubtotalIdr: 0,
    seasonId: null, startsAt: null, endsAt: null, active: true, rankOnly: false, kitOnly: false,
    ...overrides,
  };
}

describe("priceCart — diskon otomatis", () => {
  const vip = rank("vip-auto", 1, 100_000);
  const base = { items: [cart(vip)], catalog: new Map([[vip.id, vip]]), ownedByTarget: new Map(), settings, now: NOW, seasonId: "season-1" };

  it("memilih promo terbesar tanpa menumpuk dan mencatat atribusi", () => {
    const result = priceCart({ ...base, coupon: coupon(), automaticDiscounts: [automatic(), automatic({ id: "auto-2", type: "FIXED", value: 25_000, name: "Promo tetap" })] });
    expect(result).toMatchObject({ ok: true, discountIdr: 25_000, totalIdr: 75_000, couponCode: null, discountLabel: "Promo tetap", discountKind: "AUTOMATIC", automaticDiscountId: "auto-2" });
  });

  it("memilih kupon lebih besar atau setara tanpa mencatat promo otomatis", () => {
    for (const value of [20, 30]) {
      const result = priceCart({ ...base, coupon: coupon({ value }), automaticDiscounts: [automatic()] });
      expect(result).toMatchObject({ discountIdr: value * 1000, couponCode: "HEMAT10", discountKind: "COUPON", automaticDiscountId: null });
    }
  });

  it("menghormati periode, minimum, status, season dan jenis keranjang", () => {
    const invalid = [
      { active: false }, { minSubtotalIdr: 100_001 }, { seasonId: "season-2" }, { kitOnly: true },
      { startsAt: new Date(NOW.getTime() + 1) }, { endsAt: new Date(NOW.getTime() - 1) },
    ];
    for (const override of invalid) {
      expect(priceCart({ ...base, automaticDiscounts: [automatic(override)] }).discountIdr).toBe(0);
    }
    const eligible = automatic({ startsAt: NOW, endsAt: NOW, minSubtotalIdr: 100_000, seasonId: "season-1", rankOnly: true });
    expect(priceCart({ ...base, automaticDiscounts: [eligible] }).discountIdr).toBe(20_000);
  });

  it("menghitung promo dari selisih upgrade dan membatasi ke subtotal sebelum pajak", () => {
    const old = rank("old-auto", 1, 40_000);
    const upgraded = rank("new-auto", 2, 100_000);
    const result = priceCart({ ...base, items: [cart(upgraded)], catalog: new Map([[upgraded.id, upgraded]]), ownedByTarget: new Map([[UUID_A, [owned(old)]]]), automaticDiscounts: [automatic({ type: "FIXED", value: 100_000 })], settings: { ...settings, taxPercent: 11 } });
    expect(result).toMatchObject({ subtotalIdr: 60_000, discountIdr: 60_000, taxIdr: 0, totalIdr: 0 });
  });

  it("tetap melaporkan kesalahan kupon yang tidak valid", () => {
    const result = priceCart({ ...base, coupon: coupon({ active: false }), automaticDiscounts: [automatic()] });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("COUPON_INACTIVE");
    expect(result.discountIdr).toBe(20_000);
  });
});

describe("cakupan potongan pilihan admin", () => {
  const r = rank("scope-rank", 1, 10_000);
  const k = kit("scope-kit", 20_000);
  const base = { items: [cart(r), cart(k)], catalog: new Map([[r.id, r], [k.id, k]]), ownedByTarget: new Map(), settings, now: NOW };
  it("kupon rank dapat mencakup seluruh keranjang atau hanya harga rank", () => {
    expect(priceCart({ ...base, coupon: coupon({ rankOnly: true }) }).discountIdr).toBe(3_000);
    expect(priceCart({ ...base, coupon: coupon({ rankOnly: true, eligibleItemsOnly: true }) }).discountIdr).toBe(1_000);
    expect(priceCart({ ...base, coupon: coupon({ kitOnly: true, eligibleItemsOnly: true }) }).discountIdr).toBe(2_000);
    expect(priceCart({ ...base, coupon: coupon({ eligibleItemsOnly: true }) }).discountIdr).toBe(3_000);
  });
  it("diskon nominal tidak melebihi subtotal kategori; minimum/tier memakai seluruh keranjang", () => {
    const result = priceCart({ ...base, coupon: coupon({ rankOnly: true, eligibleItemsOnly: true, minSubtotalIdr: 30_000, tiers: [{ minSubtotalIdr: 30_000, type: "FIXED", value: 15_000 }] }) });
    expect(result).toMatchObject({ ok: true, subtotalIdr: 30_000, discountIdr: 10_000, totalIdr: 20_000 });
  });
  it("promo otomatis mengikuti cakupan dan tetap dibandingkan dengan kupon tanpa stacking", () => {
    const restricted = automatic({ rankOnly: true, eligibleItemsOnly: true, value: 20 });
    const autoResult = priceCart({ ...base, automaticDiscounts: [restricted] });
    expect(autoResult).toMatchObject({ discountKind: "AUTOMATIC", discountIdr: 2_000 });
    const tied = priceCart({ ...base, coupon: coupon({ kitOnly: true, eligibleItemsOnly: true }), automaticDiscounts: [restricted] });
    expect(tied).toMatchObject({ discountKind: "COUPON", discountIdr: 2_000 });
    const all = priceCart({ ...base, automaticDiscounts: [automatic({ rankOnly: true, value: 20 })] });
    expect(all.discountIdr).toBe(6_000);
  });
  it("cakupan rank pada upgrade dihitung dari selisih, bukan harga katalog penuh", () => {
    const old = rank("scope-old", 1, 40_000), upgraded = rank("scope-new", 2, 100_000);
    const result = priceCart({ ...base, items: [cart(upgraded), cart(k)], catalog: new Map([[upgraded.id, upgraded], [k.id, k]]), ownedByTarget: new Map([[UUID_A, [owned(old)]]]), coupon: coupon({ rankOnly: true, eligibleItemsOnly: true }) });
    expect(result).toMatchObject({ subtotalIdr: 80_000, discountIdr: 6_000, totalIdr: 74_000 });
  });
});
