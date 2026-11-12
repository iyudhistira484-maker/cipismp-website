/**
 * Hanya izinkan redirect internal (mencegah open redirect):
 * target harus diawali satu "/" dan tidak boleh "//host" atau "/\host".
 */
export const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function safeNext(next: string | null | undefined): string {
  if (!next) return DEFAULT_AUTH_REDIRECT;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_AUTH_REDIRECT;
  if (next.includes("\n") || next.includes("\r")) return DEFAULT_AUTH_REDIRECT;
  return next;
}

/** Staf dan pelanggan memiliki area akun masing-masing; tujuan toko lain tetap dihormati. */
export function safeNextForRole(next: string | null | undefined, role: "OWNER" | "ADMIN" | "SUPPORT" | "CUSTOMER"): string {
  const destination = safeNext(next);
  const path = destination.split(/[?#]/, 1)[0];
  if (role !== "CUSTOMER" && (path === "/dashboard" || path?.startsWith("/dashboard/"))) return "/admin";
  return destination;
}
