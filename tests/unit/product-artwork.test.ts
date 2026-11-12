import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getProductArtwork, PRODUCT_ARTWORK_CHOICES } from "@/lib/product-artwork";

describe("ilustrasi rank katalog", () => {
  it("menyediakan ilustrasi unik untuk empat rank aktif dan tiga rank arsip", () => {
    const slugs = ["star-cipi", "milk-cipi", "pop-cipi", "cute-cipi", "iron", "gold", "diamond"];
    const artwork = slugs.map((slug) => getProductArtwork(slug));

    expect(artwork.every(Boolean)).toBe(true);
    expect(new Set(artwork).size).toBe(slugs.length);
    expect(artwork.every((path) => path?.startsWith("/images/products/") && path.endsWith(".jpg"))).toBe(true);
    expect(artwork.every((path) => Boolean(path && existsSync(resolve(process.cwd(), "public", path.slice(1)))))).toBe(true);
  });

  it("tidak menampilkan ilustrasi AI kit lama dan membatasi pilihan admin ke rank", () => {
    expect(getProductArtwork("starter", "/images/products/starter.jpg")).toBeNull();
    expect(getProductArtwork("builder", "/images/products/builder.jpg")).toBeNull();
    expect(getProductArtwork("explorer", "/images/products/explorer.jpg")).toBeNull();
    expect(PRODUCT_ARTWORK_CHOICES).toHaveLength(7);
    expect(PRODUCT_ARTWORK_CHOICES.every((choice) => !choice.value.includes("/starter.") && !choice.value.includes("/builder.") && !choice.value.includes("/explorer."))).toBe(true);
  });

  it("mempertahankan fallback rank terpilih dan menolak URL eksternal", () => {
    expect(getProductArtwork("iron")).toBe("/images/products/iron.jpg");
    expect(getProductArtwork("slug-baru", "/images/products/cute-cipi.jpg")).toBe("/images/products/cute-cipi.jpg");
    expect(getProductArtwork("produk-baru")).toBeNull();
    expect(getProductArtwork("produk-baru", "https://example.com/image.jpg")).toBeNull();
  });
});
