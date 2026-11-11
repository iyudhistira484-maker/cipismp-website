import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Header keamanan. CSP dirakit manual (nonce per request ditambahkan di
 * middleware untuk skrip Next.js). Lihat docs/ARCHITECTURE.md §Keamanan.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Allow the Arena preview iframe in development; production remains clickjacking-protected.
  ...(!isDev ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The preview runs at a per-sandbox *.e2b.app hostname.
  allowedDevOrigins: isDev ? ["*.e2b.app"] : undefined,
  output: "standalone",
  serverExternalPackages: ["nodemailer", "ioredis"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          ...securityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
