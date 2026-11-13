import { priceCart, type AutomaticDiscountInput, type PriceableProduct } from "./pricing";

/** An unpersonalized estimate, never a replacement for checkout's server-side price. */
export function estimateCatalogPricing(
  items: { product: PriceableProduct; quantity: number }[],
  discounts: AutomaticDiscountInput[],
  seasonId: string | null,
  now = new Date(),
) {
  return priceCart({
    items: items.map(({ product, quantity }, index) => ({ productId: product.id, quantity, targetUuid: `estimate-${index}`, targetName: "" })),
    catalog: new Map(items.map(({ product }) => [product.id, product])),
    ownedByTarget: new Map(),
    automaticDiscounts: seasonId ? discounts : [],
    seasonId,
    settings: { taxPercent: 0, feeMode: "absorb", feeFlatIdr: 0, feePercent: 0, seasonFrozen: false },
    now,
  });
}
