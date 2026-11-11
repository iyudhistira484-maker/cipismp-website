/**
 * Worker CipiSMP Store — proses terpisah dari web.
 * Menjalankan antrean job dan tugas terjadwal (lihat src/server/jobs/runner.ts).
 * Jalankan dengan `npm run worker` (service `worker` di docker-compose).
 */
import "dotenv/config";
import { pool } from "@/server/db";
import { logger } from "@/server/logger";
import { createTickState, runWorkerTick } from "@/server/jobs/runner";

const TICK_MS = Number(process.env.WORKER_TICK_MS ?? 5000);
let shuttingDown = false;

async function main(): Promise<void> {
  logger.info("worker_started", { pid: process.pid, tickMs: TICK_MS });
  const state = createTickState();

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("worker_shutdown", { signal });
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  while (!shuttingDown) {
    try {
      await runWorkerTick(state);
    } catch (error) {
      logger.error("worker_tick_error", { error: (error as Error).message });
    }
    await new Promise((resolve) => setTimeout(resolve, TICK_MS));
  }
}

void main();
