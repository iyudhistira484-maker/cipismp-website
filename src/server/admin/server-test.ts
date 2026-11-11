import { createHmac, randomUUID } from "node:crypto";
import { decryptSecret } from "../crypto";

export interface ServerTestResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/** Uji koneksi plugin: GET {baseUrl}/cipismp/health dengan signature yang sama seperti pengiriman. */
export async function testPluginEndpoint(baseUrl: string, secret: string): Promise<ServerTestResult> {
  const base = baseUrl.replace(/\/$/, "");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const body = "";
  const signature = createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base}/cipismp/health`, {
      method: "GET",
      headers: {
        "X-Cipi-Timestamp": timestamp,
        "X-Cipi-Nonce": nonce,
        "X-Cipi-Signature": signature,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, message: `Plugin menolak (HTTP ${response.status}): ${text.slice(0, 160)}` };
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, message: "Respons plugin bukan JSON valid." };
    }
    if (parsed.ok !== true) return { ok: false, message: "Plugin melaporkan status tidak sehat." };
    const pending = typeof parsed.pendingDeliveries === "number" ? parsed.pendingDeliveries : 0;
    return {
      ok: true,
      message: `Plugin v${String(parsed.version ?? "?")} terhubung. ${String(parsed.playersOnline ?? 0)} pemain online, ${pending} pengiriman tertunda.`,
      details: parsed,
    };
  } catch (error) {
    return { ok: false, message: `Tidak bisa menghubungi plugin: ${(error as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Uji kredensial RCON dengan login lalu keluar tanpa menjalankan perintah. */
export async function testRcon(host: string, port: number, encryptedPassword: string | null): Promise<ServerTestResult> {
  const password = decryptSecret(encryptedPassword);
  if (!password) return { ok: false, message: "Password RCON belum diatur." };
  const { execRconCommands } = await import("../delivery/rcon");
  try {
    await execRconCommands({ host, port, password }, ["list"]);
    return { ok: true, message: "Login RCON berhasil; perintah uji `list` dijalankan." };
  } catch (error) {
    return { ok: false, message: `RCON gagal: ${(error as Error).message}` };
  }
}
