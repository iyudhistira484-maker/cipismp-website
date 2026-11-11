/**
 * Mesin harga CipiSMP Store — fungsi murni, tanpa I/O.
 *
 * Aturan yang ditegakkan di sini (docs/BUSINESS_RULES di ARCHITECTURE.md):
 * 1. Rank yang sudah dimiliki pada season ini tidak bisa dibeli lagi.
 * 2. Upgrade ke tier lebih tinggi hanya membayar selisih harga.
 * 3. Membeli tier lebih rendah dari yang dimiliki diblokir.
 * 4. Kit dibatasi maxPerSeason per pemain per season (+ cooldown opsional).
 * 5. Semua total dihitung server-side; klien tidak pernah menentukan harga.
 * 6. Freeze window menjelang akhir season memblokir pembelian baru.
 * 7. Diskon tidak pernah membuat total negatif.
 */
import { clampNonNegative, percentOf, computeTotal } from "./money";

export type PriceableType = "RANK" | "KIT";

export interface PriceableProduct {
  id: string;
  slug: string;
  name: string;
  type: PriceableType;
  priceIdr: number;
  tier: number;
  maxPerSeason: number;
  cooldownHours: number;
  status: "DRAFT" | "PUBLISHED";
  deletedAt?: Date | null;
}

export interface OwnedEntitlement {
  productId: string;
  productName: string;
  productType: PriceableType;
  tier: number;
  productPriceIdr: number;
  active: boolean;
  createdAt: Date;
}

export interface CartLineInput {
  productId: string;
  quantity?: number;
  targetUuid: string;
  targetName: string;
}

export interface CouponInput {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotalIdr: number;
  maxRedemptions: number | null;
  maxPerUser: number;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  rankOnly: boolean;
  kitOnly: boolean;
  redemptionsTotal: number;
  redemptionsByBuyer: number;
}

export interface PricingSettings {
  taxPercent: number;
  feeMode: "absorb" | "pass";
  feeFlatIdr: number;
  feePercent: number;
  seasonFrozen: boolean;
}

export type PricingErrorCode =
  | "PRODUCT_UNAVAILABLE"
  | "INVALID_QUANTITY"
  | "MISSING_TARGET"
  | "RANK_ALREADY_OWNED"
  | "RANK_DOWNGRADE"
  | "RANK_ONE_PER_ORDER"
  | "KIT_LIMIT_REACHED"
  | "KIT_COOLDOWN"
  | "SEASON_FROZEN"
  | "COUPON_INACTIVE"
  | "COUPON_NOT_STARTED"
  | "COUPON_EXPIRED"
  | "COUPON_MIN_SUBTOTAL"
  | "COUPON_LIMIT_REACHED"
  | "COUPON_PER_USER_LIMIT"
  | "COUPON_TYPE_MISMATCH"
  | "EMPTY_CART";

export interface PricingError {
  code: PricingErrorCode;
  productId?: string;
  message: string;
}

export interface PricedLine {
  productId: string;
  slug: string;
  name: string;
  type: PriceableType;
  quantity: number;
  listPriceIdr: number;
  unitPriceIdr: number;
  lineTotalIdr: number;
  targetUuid: string;
  targetName: string;
  upgradeFrom: { productId: string; name: string; amountIdr: number } | null;
}

export interface PricingResult {
  ok: boolean;
  errors: PricingError[];
  lines: PricedLine[];
  subtotalIdr: number;
  discountIdr: number;
  taxIdr: number;
  feeIdr: number;
  totalIdr: number;
  couponCode: string | null;
}

const ERRORS: Record<PricingErrorCode, string> = {
  PRODUCT_UNAVAILABLE: "Produk tidak tersedia untuk dibeli.",
  INVALID_QUANTITY: "Jumlah item tidak valid.",
  MISSING_TARGET: "Tentukan pemain penerima (UUID) terlebih dahulu.",
  RANK_ALREADY_OWNED: "Rank ini sudah kamu miliki di season ini.",
  RANK_DOWNGRADE: "Tidak bisa membeli rank yang lebih rendah dari rank yang sedang aktif.",
  RANK_ONE_PER_ORDER: "Hanya satu rank per transaksi. Rank lain bisa dibeli terpisah.",
  KIT_LIMIT_REACHED: "Batas pembelian kit ini untuk season ini sudah tercapai.",
  KIT_COOLDOWN: "Kit ini baru bisa dibeli lagi setelah cooldown berakhir.",
  SEASON_FROZEN: "Pembelian ditutup menjelang akhir season.",
  COUPON_INACTIVE: "Kode kupon tidak aktif.",
  COUPON_NOT_STARTED: "Kode kupon belum berlaku.",
  COUPON_EXPIRED: "Kode kupon sudah kedaluwarsa.",
  COUPON_MIN_SUBTOTAL: "Belanja minimum untuk kupon ini belum terpenuhi.",
  COUPON_LIMIT_REACHED: "Kuota kupon sudah habis.",
  COUPON_PER_USER_LIMIT: "Kamu sudah memakai kupon ini.",
  COUPON_TYPE_MISMATCH: "Kupon ini tidak berlaku untuk jenis produk di keranjang.",
  EMPTY_CART: "Keranjang kosong.",
};

function err(code: PricingErrorCode, productId?: string): PricingError {
  return { code, productId, message: ERRORS[code] };
}

export function validateCoupon(
  coupon: CouponInput,
  subtotalIdr: number,
  typesInCart: Set<PriceableType>,
  now: Date,
): PricingError[] {
  const errors: PricingError[] = [];
  if (!coupon.active) errors.push(err("COUPON_INACTIVE"));
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) errors.push(err("COUPON_NOT_STARTED"));
  if (coupon.endsAt && coupon.endsAt.getTime() < now.getTime()) errors.push(err("COUPON_EXPIRED"));
  if (coupon.maxRedemptions !== null && coupon.redemptionsTotal >= coupon.maxRedemptions)
    errors.push(err("COUPON_LIMIT_REACHED"));
  if (coupon.maxPerUser > 0 && coupon.redemptionsByBuyer >= coupon.maxPerUser)
    errors.push(err("COUPON_PER_USER_LIMIT"));
  if (coupon.rankOnly && !typesInCart.has("RANK")) errors.push(err("COUPON_TYPE_MISMATCH"));
  if (coupon.kitOnly && !typesInCart.has("KIT")) errors.push(err("COUPON_TYPE_MISMATCH"));
  if (coupon.value <= 0) errors.push(err("COUPON_INACTIVE"));
  return errors;
}

export function couponDiscount(coupon: CouponInput, subtotalIdr: number): number {
  const raw = coupon.type === "PERCENT" ? percentOf(subtotalIdr, coupon.value) : coupon.value;
  return clampNonNegative(Math.min(raw, subtotalIdr));
}

export interface PriceCartArgs {
  items: CartLineInput[];
  catalog: Map<string, PriceableProduct>;
  ownedByTarget: Map<string, OwnedEntitlement[]>;
  coupon?: CouponInput | null;
  settings: PricingSettings;
  now?: Date;
}

export function priceCart(args: PriceCartArgs): PricingResult {
  const now = args.now ?? new Date();
  const errors: PricingError[] = [];
  const lines: PricedLine[] = [];
  const seen = new Set<string>();
  let rankCount = 0;

  for (const item of args.items) {
    const product = args.catalog.get(item.productId);
    const quantity = item.quantity ?? 1;

    if (!product || product.status !== "PUBLISHED" || product.deletedAt) {
      errors.push(err("PRODUCT_UNAVAILABLE", item.productId));
      continue;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      errors.push(err("INVALID_QUANTITY", product.id));
      continue;
    }
    if (!item.targetUuid) {
      errors.push(err("MISSING_TARGET", product.id));
      continue;
    }
    if (seen.has(`${product.id}:${item.targetUuid}`)) continue;
    seen.add(`${product.id}:${item.targetUuid}`);

    const owned = (args.ownedByTarget.get(item.targetUuid) ?? []).filter(
      (o) => o.active && o.productType === product.type,
    );

    if (product.type === "RANK") {
      rankCount += 1;
      if (quantity !== 1) {
        errors.push(err("INVALID_QUANTITY", product.id));
        continue;
      }
      const ownedRank = owned.reduce<OwnedEntitlement | null>(
        (best, o) => (!best || o.tier > best.tier ? o : best),
        null,
      );
      if (ownedRank) {
        if (ownedRank.tier === product.tier) {
          errors.push(err("RANK_ALREADY_OWNED", product.id));
          continue;
        }
        if (ownedRank.tier > product.tier) {
          errors.push(err("RANK_DOWNGRADE", product.id));
          continue;
        }
        const upgradeAmount = clampNonNegative(product.priceIdr - ownedRank.productPriceIdr);
        lines.push({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          type: product.type,
          quantity: 1,
          listPriceIdr: product.priceIdr,
          unitPriceIdr: upgradeAmount,
          lineTotalIdr: upgradeAmount,
          targetUuid: item.targetUuid,
          targetName: item.targetName,
          upgradeFrom: {
            productId: ownedRank.productId,
            name: ownedRank.productName,
            amountIdr: ownedRank.productPriceIdr,
          },
        });
        continue;
      }
      lines.push({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        type: product.type,
        quantity: 1,
        listPriceIdr: product.priceIdr,
        unitPriceIdr: product.priceIdr,
        lineTotalIdr: product.priceIdr,
        targetUuid: item.targetUuid,
        targetName: item.targetName,
        upgradeFrom: null,
      });
      continue;
    }

    // KIT
    const kitOwned = owned.filter((o) => o.productId === product.id);
    if (kitOwned.length >= product.maxPerSeason) {
      errors.push(err("KIT_LIMIT_REACHED", product.id));
      continue;
    }
    if (product.cooldownHours > 0 && kitOwned.length > 0) {
      const last = kitOwned.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
      const availableAt = last.createdAt.getTime() + product.cooldownHours * 3_600_000;
      if (availableAt > now.getTime()) {
        errors.push(err("KIT_COOLDOWN", product.id));
        continue;
      }
    }
    const lineTotal = product.priceIdr * quantity;
    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      type: product.type,
      quantity,
      listPriceIdr: product.priceIdr,
      unitPriceIdr: product.priceIdr,
      lineTotalIdr: lineTotal,
      targetUuid: item.targetUuid,
      targetName: item.targetName,
      upgradeFrom: null,
    });
  }

  if (rankCount > 1) errors.push(err("RANK_ONE_PER_ORDER"));
  if (args.settings.seasonFrozen) errors.push(err("SEASON_FROZEN"));
  if (args.items.length === 0) errors.push(err("EMPTY_CART"));

  const subtotalIdr = lines.reduce((sum, l) => sum + l.lineTotalIdr, 0);
  let discountIdr = 0;
  let couponCode: string | null = null;

  if (args.coupon && lines.length > 0) {
    const typesInCart = new Set<PriceableType>(lines.map((l) => l.type));
    const couponErrors = validateCoupon(args.coupon, subtotalIdr, typesInCart, now);
    if (subtotalIdr < args.coupon.minSubtotalIdr && couponErrors.length === 0) {
      couponErrors.push(err("COUPON_MIN_SUBTOTAL"));
    }
    if (couponErrors.length === 0) {
      discountIdr = couponDiscount(args.coupon, subtotalIdr);
      couponCode = args.coupon.code;
    } else {
      errors.push(...couponErrors);
    }
  }

  const taxable = clampNonNegative(subtotalIdr - discountIdr);
  const taxIdr = args.settings.taxPercent > 0 ? percentOf(taxable, args.settings.taxPercent) : 0;
  const feeIdr =
    args.settings.feeMode === "pass"
      ? clampNonNegative(args.settings.feeFlatIdr + percentOf(taxable + taxIdr, args.settings.feePercent))
      : 0;
  const totalIdr = computeTotal(subtotalIdr, discountIdr, taxIdr, feeIdr);

  return {
    ok: errors.length === 0,
    errors,
    lines,
    subtotalIdr,
    discountIdr,
    taxIdr,
    feeIdr,
    totalIdr,
    couponCode,
  };
}

/**
 * Harga per item untuk halaman produk (tanpa keranjang), dipakai untuk menampilkan
 * "harga upgrade" secara personal di halaman rank.
 */
export function personalRankPrice(
  product: PriceableProduct,
  owned: OwnedEntitlement | null,
): { payableIdr: number; blocked: "ALREADY_OWNED" | "DOWNGRADE" | null; savedIdr: number } {
  if (!owned) return { payableIdr: product.priceIdr, blocked: null, savedIdr: 0 };
  if (owned.tier === product.tier) return { payableIdr: 0, blocked: "ALREADY_OWNED", savedIdr: product.priceIdr };
  if (owned.tier > product.tier)
    return {
      payableIdr: 0,
      blocked: "DOWNGRADE",
      savedIdr: 0,
    };
  const payable = clampNonNegative(product.priceIdr - owned.productPriceIdr);
  return { payableIdr: payable, blocked: null, savedIdr: product.priceIdr - payable };
}
