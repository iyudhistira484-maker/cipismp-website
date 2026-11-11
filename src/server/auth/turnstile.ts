import { env } from "../env";
import { logger } from "../logger";

/**
 * Cloudflare Turnstile (opsional). Bila TURNSTILE_ENABLED=0, fungsi ini
 * mengembalikan true agar form tetap bisa dipakai di dev/test.
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_ENABLED) return true;
  if (!env.TURNSTILE_SECRET_KEY) {
    logger.warn("turnstile_missing_secret");
    return false;
  }
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (error) {
    logger.warn("turnstile_verify_failed", { error: (error as Error).message });
    return false;
  }
}
