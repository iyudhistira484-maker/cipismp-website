import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getProductArtwork, PRODUCT_ARTWORK_CHOICES } from "@/lib/product-artwork";

describe("ilustrasi raster katalog", () => {
  it("menyediakan ilustrasi unik untuk empat rank baru dan tiga kit seed", () => {
    const slugs = ["star-cipi", "milk-cipi", "pop-cipi", "cute-cipi", "starter", "builder", "explorer"];
    const artwork = slugs.map((slug) => getProductArtwork(slug));

    expect(artwork.every(Boolean)).toBe(true);
    expect(new Set(artwork).size).toBe(slugs.length);
    expect(artwork.every((path) => path?.startsWith("/images/products/") && path.endsWith(".jpg"))).toBe(true);
    expect(artwork.every((path) => Boolean(path && existsSync(resolve(process.cwd(), "public", path.slice(1)))))).toBe(true);
  });

  it("mempertahankan aset lama dan membolehkan admin memilih ilustrasi dari daftar lokal", () => {
    expect(getProductArtwork("iron")).toBe("/images/products/iron.jpg");
    expect(getProductArtwork("slug-baru", "/images/products/cute-cipi.jpg")).toBe("/images/products/cute-cipi.jpg");
    expect(PRODUCT_ARTWORK_CHOICES).toHaveLength(10);
  });

  it("menyisakan fallback vektor untuk produk tanpa ilustrasi khusus", () => {
    expect(getProductArtwork("produk-baru")).toBeNull();
    expect(getProductArtwork("produk-baru", "https://example.com/image.jpg")).toBeNull();
  });
});
