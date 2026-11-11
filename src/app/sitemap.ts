import type { MetadataRoute } from "next";
import { env } from "@/server/env";
import { getPublishedProducts } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/rank`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/kit`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/cara-kerja`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/legal/syarat-layanan`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/syarat-penjualan`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/kebijakan-privasi`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const [products, settings] = await Promise.all([getPublishedProducts(), getSettings()]);
    const legalUpdated = new Date(settings.legal.updatedAt);
    const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
      url: `${base}/${product.type === "RANK" ? "rank" : "kit"}/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return staticRoutes.map((route) =>
      route.url.includes("/legal/") ? { ...route, lastModified: legalUpdated } : route,
    ).concat(productRoutes);
  } catch {
    // Sitemap tidak boleh gagal total saat database sedang tidak bisa diakses.
    return staticRoutes;
  }
}
