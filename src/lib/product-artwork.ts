export const PRODUCT_ARTWORK_CHOICES = [
  { value: "/images/products/star-cipi.jpg", label: "Star Cipi" },
  { value: "/images/products/milk-cipi.jpg", label: "Milk Cipi" },
  { value: "/images/products/pop-cipi.jpg", label: "Pop Cipi" },
  { value: "/images/products/cute-cipi.jpg", label: "Cute Cipi" },
  { value: "/images/products/iron.jpg", label: "Iron (arsip)" },
  { value: "/images/products/gold.jpg", label: "Gold (arsip)" },
  { value: "/images/products/diamond.jpg", label: "Diamond (arsip)" },
] as const;

export const PRODUCT_ACCENT_CHOICES = [
  { value: "amber", label: "Amber" },
  { value: "star", label: "Star Cipi" },
  { value: "milk", label: "Milk Cipi" },
  { value: "pop", label: "Pop Cipi" },
  { value: "cute", label: "Cute Cipi" },
  { value: "iron", label: "Iron (arsip)" },
  { value: "gold", label: "Gold (arsip)" },
  { value: "diamond", label: "Diamond (arsip)" },
] as const;

const PRODUCT_ARTWORK_BY_SLUG: Record<string, string> = {
  "star-cipi": "/images/products/star-cipi.jpg",
  "milk-cipi": "/images/products/milk-cipi.jpg",
  "pop-cipi": "/images/products/pop-cipi.jpg",
  "cute-cipi": "/images/products/cute-cipi.jpg",
  iron: "/images/products/iron.jpg",
  gold: "/images/products/gold.jpg",
  diamond: "/images/products/diamond.jpg",
};

const VALID_ARTWORK = new Set<string>(PRODUCT_ARTWORK_CHOICES.map((choice) => choice.value));

/** Rank artwork may be selected by the admin; kits use their actual Minecraft item sprites. */
export function getProductArtwork(slug: string, artwork?: string | null): string | null {
  if (artwork && VALID_ARTWORK.has(artwork)) return artwork;
  return PRODUCT_ARTWORK_BY_SLUG[slug] ?? null;
}
