import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Satu pool per proses. Disimpan di globalThis agar hot-reload Next.js tidak
 * membuka pool baru di setiap render.
 */
const globalForDb = globalThis as unknown as {
  __cipiPool?: Pool;
  __cipiDb?: ReturnType<typeof drizzle<typeof schema>>;
};

export const pool =
  globalForDb.__cipiPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "cipismp-store",
  });

export const db = globalForDb.__cipiDb ?? drizzle(pool, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__cipiPool = pool;
  globalForDb.__cipiDb = db;
}

export { schema };
export type Db = typeof db;
