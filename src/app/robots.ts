import type { MetadataRoute } from "next";
import { env } from "@/server/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/api", "/keranjang", "/checkout", "/pesanan", "/status-pesanan", "/masuk", "/daftar"],
      },
    ],
    sitemap: `${env.APP_URL.replace(/\/$/, "")}/sitemap.xml`,
    host: env.APP_URL,
  };
}
