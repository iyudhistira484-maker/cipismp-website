import { env } from "./env";

export class CsrfError extends Error {
  constructor(message = "Permintaan ditolak: origin tidak valid.") {
    super(message);
    this.name = "CsrfError";
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Proteksi CSRF: untuk setiap request mutasi, Origin harus sama dengan APP_URL
 * (atau Sec-Fetch-Site: same-origin). Cookie session memakai SameSite=Lax +
 * httpOnly sehingga kombinasi ini menutup CSRF tanpa token per-form.
 */
export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return;

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const allowedOrigin = new URL(env.APP_URL).origin;

  if (origin) {
    if (new URL(origin).origin !== allowedOrigin) throw new CsrfError(`Origin tidak dikenal: ${origin}`);
    return;
  }
  if (fetchSite && (fetchSite === "same-origin" || fetchSite === "none")) return;
  if (fetchSite === "cross-site" || fetchSite === "same-site") throw new CsrfError();
  // Origin tidak dikirim (klien non-browser, mis. webhook gateway):
  // webhook punya verifikasi tanda tangan sendiri, jadi lolos di sini.
}

export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() ?? "unknown";
}
