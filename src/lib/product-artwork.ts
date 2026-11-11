const PRODUCT_ARTWORK: Record<string, string> = {
  iron: "/images/products/iron.jpg",
  gold: "/images/products/gold.jpg",
  diamond: "/images/products/diamond.jpg",
  starter: "/images/products/starter.jpg",
  builder: "/images/products/builder.jpg",
  explorer: "/images/products/explorer.jpg",
};

/** Hand-picked original raster art for the six published seed products. */
export function getProductArtwork(slug: string): string | null {
  return PRODUCT_ARTWORK[slug] ?? null;
}
