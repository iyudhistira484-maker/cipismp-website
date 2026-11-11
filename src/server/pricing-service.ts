import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { cartItems, coupons, couponRedemptions, products } from "./db/schema";
import { getActiveSeason } from "./catalog";
import { toPriceable } from "./catalog";
import { ownedMap } from "./entitlements";
import { getSettings } from "./settings";
import { isPurchaseFrozen } from "@/lib/seasons";
import {
  priceCart,
  type CartLineInput,
  type CouponInput,
  type PricingResult,
  type PriceableProduct,
} from "@/lib/pricing";

export interface CartPricingResult {
  result: PricingResult;
  season: { id: string; name: string; endAt: Date; freezeDays: number; status: "ACTIVE" } | null;
  products: PriceableProduct[];
  coupon: { code: string; type: "PERCENT" | "FIXED"; value: number } | null;
  frozen: boolean;
}

export interface PriceCartOptions {
  cartId: string | null;
  targetUuid: string;
  targetName: string;
  couponCode?: string | null;
  buyerEmail?: string | null;
  buyerUserId?: string | null;
}

export async function loadCoupon(code: string, subtotal: number, buyerEmail?: string | null): Promise<CouponInput | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const row = await db.query.coupons.findFirst({ where: eq(coupons.code, trimmed) });
  if (!row) return null;

  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.couponId, row.id));
  const buyerRows = buyerEmail
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponRedemptions)
        .where(and(eq(couponRedemptions.couponId, row.id), eq(couponRedemptions.email, buyerEmail.toLowerCase())))
    : [];

  return {
    code: row.code,
    type: row.type,
    value: row.value,
    minSubtotalIdr: row.minSubtotalIdr,
    maxRedemptions: row.maxRedemptions,
    maxPerUser: row.maxPerUser,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    active: row.active,
    rankOnly: row.rankOnly,
    kitOnly: row.kitOnly,
    redemptionsTotal: totalRows[0]?.count ?? 0,
    redemptionsByBuyer: buyerRows[0]?.count ?? 0,
  };
  void subtotal;
}

/** Harga keranjang yang sedang aktif — satu-satunya sumber kebenaran nominal. */
export async function priceCurrentCart(options: PriceCartOptions): Promise<CartPricingResult> {
  const season = await getActiveSeason();
  const settings = await getSettings();
  const lines = options.cartId
    ? await db.select().from(cartItems).where(eq(cartItems.cartId, options.cartId))
    : [];

  const productRows = lines.length
    ? await db.select().from(products).where(inArray(products.id, lines.map((l) => l.productId)))
    : [];
  const catalog = new Map<string, PriceableProduct>(productRows.map((p) => [p.id, toPriceable(p)]));

  // Baris hadiah memakai penerima yang tersimpan; baris biasa memakai pembeli.
  const inputs: CartLineInput[] = lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    targetUuid: line.targetUuid ?? options.targetUuid,
    targetName: line.targetName ?? options.targetName,
  }));

  const frozen = season ? isPurchaseFrozen(season) : false;
  const targetUuids = [...new Set(inputs.map((input) => input.targetUuid).filter(Boolean))];
  const owned = season && targetUuids.length > 0 ? await ownedMap(targetUuids, season.id) : new Map();

  const subtotalGuess = inputs.reduce((sum, input) => {
    const p = catalog.get(input.productId);
    return sum + (p ? p.priceIdr * (input.quantity ?? 1) : 0);
  }, 0);

  const coupon = options.couponCode ? await loadCoupon(options.couponCode, subtotalGuess, options.buyerEmail) : null;

  const result = priceCart({
    items: inputs,
    catalog,
    ownedByTarget: owned,
    coupon,
    settings: {
      taxPercent: settings.store.taxPercent,
      feeMode: settings.store.feeMode,
      feeFlatIdr: settings.store.feeFlatIdr,
      feePercent: settings.store.feePercent,
      seasonFrozen: frozen,
    },
  });

  if (!coupon && options.couponCode) {
    result.ok = false;
    result.errors.push({
      code: "COUPON_INACTIVE",
      message: "Kode kupon tidak ditemukan atau sudah tidak berlaku.",
    });
  }

  return {
    result,
    season: season
      ? { id: season.id, name: season.name, endAt: season.endAt, freezeDays: season.freezeDays, status: "ACTIVE" }
      : null,
    products: productRows.map(toPriceable),
    coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : null,
    frozen,
  };
}

/** Harga satu produk untuk halaman detail (memperhitungkan upgrade). */
export async function priceSingleProduct(
  productId: string,
  targetUuid: string,
  targetName: string,
): Promise<CartPricingResult> {
  const season = await getActiveSeason();
  const settings = await getSettings();
  const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const product = rows[0];
  const catalog = new Map<string, PriceableProduct>(product ? [[product.id, toPriceable(product)]] : []);
  const frozen = season ? isPurchaseFrozen(season) : false;
  const owned = season && targetUuid ? await ownedMap([targetUuid], season.id) : new Map();

  const result = priceCart({
    items: product ? [{ productId: product.id, quantity: 1, targetUuid, targetName }] : [],
    catalog,
    ownedByTarget: owned,
    coupon: null,
    settings: {
      taxPercent: settings.store.taxPercent,
      feeMode: settings.store.feeMode,
      feeFlatIdr: settings.store.feeFlatIdr,
      feePercent: settings.store.feePercent,
      seasonFrozen: frozen,
    },
  });

  return {
    result,
    season: season
      ? { id: season.id, name: season.name, endAt: season.endAt, freezeDays: season.freezeDays, status: "ACTIVE" }
      : null,
    products: product ? [toPriceable(product)] : [],
    coupon: null,
    frozen,
  };
}
