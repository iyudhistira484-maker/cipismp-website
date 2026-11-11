import type { Metadata, Viewport } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { env } from "@/server/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: "CipiSMP Store — Rank & Kit Season 1",
    template: "%s · CipiSMP Store",
  },
  description:
    "Toko resmi CipiSMP: rank dan kit untuk server survival Season 1. Cross-play Java & Bedrock, pengiriman otomatis setelah pembayaran terverifikasi.",
  applicationName: "CipiSMP Store",
  keywords: ["CipiSMP", "Minecraft Indonesia", "rank Minecraft", "server SMP", "kit Minecraft"],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "CipiSMP Store",
    title: "CipiSMP Store — Rank & Kit Season 1",
    description:
      "Rank dan kit untuk server survival CipiSMP. Berlaku sampai akhir season, dikirim otomatis setelah pembayaran.",
    url: env.APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "CipiSMP Store — Rank & Kit Season 1",
    description: "Rank dan kit untuk server survival CipiSMP. Cross-play Java & Bedrock.",
  },
  robots: env.APP_ENV === "production" ? { index: true, follow: true } : { index: false, follow: false },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0e0d0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-dvh antialiased">
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          Lewati ke konten
        </a>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
