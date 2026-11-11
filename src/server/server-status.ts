import { eq } from "drizzle-orm";
import { db } from "./db";
import { servers } from "./db/schema";
import { logger } from "./logger";

export interface ServerStatus {
  online: boolean | null;
  players: number | null;
  maxPlayers: number | null;
  version: string | null;
  source: "mcsrvstat" | "custom" | "unavailable";
  checkedAt: string;
  javaHost: string;
  javaPort: number;
  bedrockHost: string;
  bedrockPort: number;
}

interface CacheEntry {
  value: ServerStatus;
  at: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 45_000;

async function defaultServer() {
  return db.query.servers.findFirst({ where: eq(servers.isDefault, true) });
}

/**
 * Status server diambil dari API publik (atau endpoint milik admin). Jika gagal,
 * toko tetap tampil normal dan UI menampilkan status "tidak tersedia".
 */
export async function getServerStatus(): Promise<ServerStatus> {
  const server = await defaultServer();
  const javaHost = server?.javaHost ?? "cipismp.my.id";
  const javaPort = server?.javaPort ?? 25565;
  const bedrockHost = server?.bedrockHost ?? javaHost;
  const bedrockPort = server?.bedrockPort ?? 19202;
  const cacheKey = `${javaHost}:${javaPort}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const base: Omit<ServerStatus, "online" | "players" | "maxPlayers" | "version" | "source" | "checkedAt"> = {
    javaHost,
    javaPort,
    bedrockHost,
    bedrockPort,
  };

  async function finalize(value: ServerStatus): Promise<ServerStatus> {
    cache.set(cacheKey, { value, at: Date.now() });
    return value;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const url = server?.statusApiUrl
      ? server.statusApiUrl
      : `https://api.mcsrvstat.us/3/${encodeURIComponent(javaHost)}${javaPort === 25565 ? "" : `:${javaPort}`}`;
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as {
      online?: boolean;
      players?: { online?: number; max?: number };
      version?: string;
    };
    return await finalize({
      ...base,
      online: Boolean(data.online),
      players: data.players?.online ?? 0,
      maxPlayers: data.players?.max ?? null,
      version: data.version ?? null,
      source: server?.statusApiUrl ? "custom" : "mcsrvstat",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn("server_status_unavailable", { error: (error as Error).message });
    return await finalize({
      ...base,
      online: null,
      players: null,
      maxPlayers: null,
      version: null,
      source: "unavailable",
      checkedAt: new Date().toISOString(),
    });
  }
}
