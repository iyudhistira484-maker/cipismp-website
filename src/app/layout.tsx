import type { Metadata, Viewport } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { headers } from "next/headers";
import { env } from "@/server/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: "CipiSMP Store — Toko Resmi Server Minecraft",
    template: "%s | CipiSMP Store",
  },
  description:
    "Toko resmi server survival CipiSMP. Pilih rank dan kit musiman untuk Java & Bedrock; masa aktif, harga, dan detail tersedia sebelum checkout.",
  applicationName: "CipiSMP Store",
  keywords: ["CipiSMP", "Minecraft Indonesia", "rank Minecraft", "server SMP", "kit Minecraft"],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "CipiSMP Store",
    title: "CipiSMP Store — Toko Resmi Server Minecraft",
    description:
      "Rank dan kit musiman untuk server survival CipiSMP. Tersedia untuk pemain Java dan Bedrock.",
    url: env.APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "CipiSMP Store — Toko Resmi Server Minecraft",
    description: "Rank dan kit musiman untuk server survival CipiSMP. Tersedia untuk Java dan Bedrock.",
  },
  robots: env.APP_ENV === "production" ? { index: true, follow: true } : { index: false, follow: false },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#fefbfd",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pages with a per-request CSP nonce must be rendered per request. Static HTML
  // has no matching nonce and its hydration scripts are blocked by strict CSP.
  await headers();
  return (
    <html lang="id">
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
