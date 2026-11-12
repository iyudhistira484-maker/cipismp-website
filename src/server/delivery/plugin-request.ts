import { lt } from "drizzle-orm";
import { db } from "../db";
import { pluginNonces } from "../db/schema";
import { ids } from "../ids";
import { pluginSharedSecret, verifyPluginSignature } from "./plugin-auth";

export type VerifiedPluginBody =
  | { ok: true; body: string }
  | { ok: false; status: number; message: string };

/** Verify the HMAC and consume its nonce before any plugin API action is performed. */
export async function verifyAndConsumePluginRequest(request: Request): Promise<VerifiedPluginBody> {
  const secret = pluginSharedSecret();
  if (!secret || secret.length < 16) {
    return { ok: false, status: 503, message: "PLUGIN_SHARED_SECRET belum dikonfigurasi dengan minimal 16 karakter" };
  }

  const body = await request.text();
  if (body.length > 128_000) return { ok: false, status: 413, message: "Payload terlalu besar" };

  const timestamp = request.headers.get("x-cipi-timestamp") ?? "";
  const nonce = request.headers.get("x-cipi-nonce") ?? "";
  const signature = request.headers.get("x-cipi-signature") ?? "";
  if (!/^[A-Za-z0-9-]{8,128}$/.test(nonce)) {
    return { ok: false, status: 401, message: "Nonce tidak valid" };
  }

  const verification = verifyPluginSignature({ secret, timestamp, nonce, signature, body });
  if (!verification.ok) return { ok: false, status: 401, message: verification.reason ?? "Signature tidak valid" };

  // Nonces older than twice the allowed request clock-skew can no longer be replayed.
  await db.delete(pluginNonces).where(lt(pluginNonces.createdAt, new Date(Date.now() - 10 * 60_000)));
  const inserted = await db
    .insert(pluginNonces)
    .values({ id: ids.nonce(), nonce })
    .onConflictDoNothing({ target: pluginNonces.nonce })
    .returning({ id: pluginNonces.id });
  if (inserted.length === 0) return { ok: false, status: 409, message: "Nonce sudah dipakai" };

  return { ok: true, body };
}
