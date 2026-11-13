import { env } from "./env";
import { currentCodespacesPreviewHost, isCodespacesSameOriginRequest } from "@/lib/codespaces-preview";

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
    // Codespaces' proxy may replace the browser Origin with localhost. Never
    // trust that rewritten value alone: the exact configured proxy host and
    // browser's same-origin Fetch Metadata are required, and only in dev.
    if (isCodespacesSameOriginRequest(request.headers, currentCodespacesPreviewHost(env.APP_URL))) return;
    let parsedOrigin: string;
    try {
      parsedOrigin = new URL(origin).origin;
    } catch {
      throw new CsrfError("Origin tidak valid.");
    }
    if (parsedOrigin !== allowedOrigin) throw new CsrfError(`Origin tidak dikenal: ${origin}`);
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
