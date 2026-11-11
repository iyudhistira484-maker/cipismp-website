import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware:
 * 1. Memastikan setiap pengunjung punya kunci keranjang tamu (cookie httpOnly).
 * 2. Menegakkan CSP dengan nonce per request (skrip Next.js otomatis memakai nonce).
 * 3. Gerbang awal /dashboard dan /admin (pemeriksaan role sebenarnya di server).
 */
const GUEST_COOKIE = "cipi_guest";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const scriptSrc = isDev
    ? "'self' 'unsafe-eval' 'unsafe-inline'"
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://mc-heads.net https://crafatar.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = makeNonce();
  const csp = contentSecurityPolicy(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const path = request.nextUrl.pathname;
  if (PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    const hasSession = request.cookies.get("cipi_session")?.value;
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/masuk";
      url.search = `?next=${encodeURIComponent(path)}`;
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  response.headers.set("X-Content-Type-Options", "nosniff");

  if (!request.cookies.get(GUEST_COOKIE)) {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const key = [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);
    response.cookies.set(GUEST_COOKIE, key, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
