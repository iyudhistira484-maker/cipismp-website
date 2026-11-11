import { createHmac, randomUUID } from "node:crypto";
import { logger } from "../logger";

/**
 * Klien HTTP ke plugin companion. Setiap request ditandatangani:
 *   signature = HMAC-SHA256(timestamp + "." + nonce + "." + body, secret)
 * Plugin menolak request dengan timestamp > 5 menit atau nonce yang sudah dipakai.
 */
export interface PluginDeliveryRequest {
  baseUrl: string;
  secret: string;
  deliveryId: string;
  uuid: string;
  playerName: string;
  commands: string[];
  reason: "PURCHASE" | "SEASON_END" | "REDELIVER";
}

export interface PluginResponse {
  ok: boolean;
  applied: number;
  failed?: Array<{ command: string; error: string }>;
  message?: string;
}

export function signPluginRequest(secret: string, timestamp: string, nonce: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}

export async function sendToPlugin(request: PluginDeliveryRequest): Promise<PluginResponse> {
  const body = JSON.stringify({
    deliveryId: request.deliveryId,
    uuid: request.uuid,
    player: request.playerName,
    commands: request.commands,
    reason: request.reason,
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const signature = signPluginRequest(request.secret, timestamp, nonce, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${request.baseUrl.replace(/\/$/, "")}/cipismp/deliver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cipi-Timestamp": timestamp,
        "X-Cipi-Nonce": nonce,
        "X-Cipi-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Plugin menolak request (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as PluginResponse;
    if (typeof json.ok !== "boolean") throw new Error("Respons plugin tidak valid");
    return json;
  } catch (error) {
    logger.warn("plugin_delivery_failed", { deliveryId: request.deliveryId, error: (error as Error).message });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
