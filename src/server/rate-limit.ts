import { env } from "./env";
import { logger } from "./logger";

/**
 * Rate limiter sliding-window. Memakai Redis bila REDIS_URL tersedia (produksi,
 * multi-instance); fallback in-memory untuk dev/test. Lihat ASSUMPTIONS.md §12.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

const memory = new Map<string, number[]>();
let redisClient: import("ioredis").Redis | null = null;

async function getRedis() {
  if (!env.REDIS_URL) return null;
  if (redisClient) return redisClient;
  try {
    const { Redis } = await import("ioredis");
    redisClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
    redisClient.on("error", (e: Error) => logger.warn("redis_error", { error: e.message }));
    return redisClient;
  } catch (error) {
    logger.warn("redis_unavailable", { error: (error as Error).message });
    return null;
  }
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const redis = await getRedis();
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (redis) {
    const bucket = `rl:${key}`;
    const count = await redis.incr(bucket);
    if (count === 1) await redis.pexpire(bucket, windowMs);
    const ttl = await redis.pttl(bucket);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)),
      limit,
    };
  }

  const timestamps = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  const allowed = timestamps.length < limit;
  if (allowed) timestamps.push(now);
  memory.set(key, timestamps);
  if (memory.size > 5000) {
    // buang bucket yang sudah kedaluwarsa agar memori tidak tumbuh tanpa batas
    for (const [k, v] of memory) {
      if (v.every((t) => now - t >= windowMs)) memory.delete(k);
    }
  }
  const oldest = timestamps[0] ?? now;
  return {
    allowed,
    remaining: Math.max(0, limit - timestamps.length),
    retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    limit,
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  memory.delete(key);
  const redis = await getRedis();
  if (redis) await redis.del(`rl:${key}`);
}

/** Untuk test deterministik. */
export function clearMemoryRateLimits(): void {
  memory.clear();
}

export class RateLimitError extends Error {
  constructor(
    public readonly retryAfterSeconds: number,
    message = "Terlalu banyak percobaan. Coba lagi nanti.",
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const result = await rateLimit(key, limit, windowSeconds);
  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
}
