import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getProductArtwork } from "@/lib/product-artwork";

describe("ilustrasi raster katalog", () => {
  it("memetakan setiap produk seed ke berkas visual yang unik", () => {
    const slugs = ["iron", "gold", "diamond", "starter", "builder", "explorer"];
    const artwork = slugs.map((slug) => getProductArtwork(slug));

    expect(artwork.every(Boolean)).toBe(true);
    expect(new Set(artwork).size).toBe(slugs.length);
    expect(artwork.every((path) => path?.startsWith("/images/products/") && path.endsWith(".jpg"))).toBe(true);
    expect(artwork.every((path) => Boolean(path && existsSync(resolve(process.cwd(), "public", path.slice(1)))))).toBe(true);
  });

  it("menyisakan fallback vektor untuk produk tanpa ilustrasi khusus", () => {
    expect(getProductArtwork("produk-baru")).toBeNull();
  });
});
