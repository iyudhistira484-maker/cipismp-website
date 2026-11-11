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
