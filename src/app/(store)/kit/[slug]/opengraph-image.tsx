import { ImageResponse } from "next/og";
import { getActiveSeason, getProductBySlug } from "@/server/catalog";
import { accentHex, fallbackOgElement, OG_CONTENT_TYPE, OG_SIZE, productOgElement } from "@/components/art/og-product";
import { formatRp } from "@/lib/money";
import { formatDateWIB } from "@/lib/dates";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "CipiSMP Store — detail produk";

export default async function ProductOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, season] = await Promise.all([getProductBySlug(slug), getActiveSeason()]);

  if (!product || product.type !== "KIT") {
    return new ImageResponse(fallbackOgElement("Produk tidak ditemukan"), size);
  }

  return new ImageResponse(
    productOgElement({
      name: product.name,
      type: "KIT",
      tagline: product.tagline,
      priceLabel: formatRp(product.priceIdr) + " / season",
      accent: accentHex(product.accent),
      seasonLabel: season ? `Season aktif sampai ${formatDateWIB(season.endAt)}` : "Menunggu season berikutnya",
      perks: Array.isArray(product.perks) ? product.perks : [],
    }),
    size,
  );
}
