import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { jobs } from "../db/schema";
import { ids } from "../ids";
import { logger } from "../logger";

/**
 * Antrean job berbasis Postgres (FOR UPDATE SKIP LOCKED) — setara BullMQ untuk
 * kebutuhan toko ini, tanpa satu pun dependensi tambahan dan bisa dipakai lintas
 * proses (web + worker). Lihat docs/ASSUMPTIONS.md §12.
 */
export type JobType =
  | "email.send"
  | "delivery.process"
  | "delivery.retry"
  | "order.expire"
  | "payment.reconcile"
  | "season.reminders"
  | "season.transition"
  | "mc.refresh-profiles";

export interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
  dedupeKey?: string;
}

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<string> {
  const id = ids.job();
  const rows = await db
    .insert(jobs)
    .values({
      id,
      type,
      payload,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? 5,
      dedupeKey: options.dedupeKey ?? null,
    })
    .onConflictDoNothing({ target: jobs.dedupeKey })
    .returning({ id: jobs.id });
  return rows[0]?.id ?? "";
}

export interface ClaimedJob {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export async function claimJobs(workerId: string, limit = 10): Promise<ClaimedJob[]> {
  const result = await db.execute(sql`
    WITH claimed AS (
      SELECT id FROM ${jobs}
      WHERE status = 'PENDING' AND run_at <= now()
      ORDER BY run_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE ${jobs} j
    SET status = 'RUNNING', locked_at = now(), locked_by = ${workerId},
        attempts = j.attempts + 1, updated_at = now()
    FROM claimed c
    WHERE j.id = c.id
    RETURNING j.id, j.type, j.payload, j.attempts, j.max_attempts
  `);
  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    type: row.type as string,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
  }));
}

export async function completeJob(id: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "DONE", finishedAt: new Date(), lockedAt: null, lockedBy: null })
    .where(eq(jobs.id, id));
}

/** Backoff eksponensial: 30s, 60s, 120s, ... maksimum 30 menit. */
export function backoffMs(attempts: number, baseSeconds = 30): number {
  return Math.min(baseSeconds * 1000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
}

export async function failJob(id: string, error: string, attempts: number, maxAttempts: number): Promise<void> {
  const dead = attempts >= maxAttempts;
  await db
    .update(jobs)
    .set({
      status: dead ? "DEAD" : "PENDING",
      lastError: error.slice(0, 2000),
      lockedAt: null,
      lockedBy: null,
      runAt: dead ? new Date() : new Date(Date.now() + backoffMs(attempts)),
      finishedAt: dead ? new Date() : null,
    })
    .where(eq(jobs.id, id));
  if (dead) logger.error("job_dead", { jobId: id, error });
}

/** Recover job RUNNING yang tertinggal karena worker mati. */
export async function reclaimStaleJobs(olderThanMinutes = 10): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const rows = await db
    .update(jobs)
    .set({ status: "PENDING", lockedAt: null, lockedBy: null })
    .where(and(eq(jobs.status, "RUNNING"), lte(jobs.lockedAt, cutoff)))
    .returning({ id: jobs.id });
  return rows.length;
}

export async function pendingJobCount(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(inArray(jobs.status, ["PENDING", "RUNNING"]));
  return rows[0]?.count ?? 0;
}
