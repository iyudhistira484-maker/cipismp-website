import { eq } from "drizzle-orm";
import { db } from "../db";
import { deliveries } from "../db/schema";
import { logger } from "../logger";
import { claimJobs, completeJob, failJob, reclaimStaleJobs } from "../queue";
import { deliverEmail } from "../email";
import { sendOrderEmail, sendSeasonEndingEmail } from "../email/order-emails";
import { processDelivery, dueDeliveries } from "../delivery";
import { expirePendingOrders } from "../orders";
import { reconcilePendingOrders } from "../payments/webhook";
import { runSeasonTransition, sendSeasonReminders, transitionDueSeasons } from "../seasons/transition";

/**
 * Satu siklus worker. Dipakai oleh proses worker (`npm run worker`) dan oleh
 * endpoint /api/cron untuk deployment yang tidak menjalankan worker terpisah.
 */
const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

interface TickState {
  lastReconcile: number;
  lastReminder: number;
  lastTransition: number;
}

export interface TickResult {
  processed: number;
  failed: number;
}

type Payload = Record<string, unknown>;

async function handleJob(type: string, payload: Payload): Promise<void> {
  switch (type) {
    case "email.send": {
      if (typeof payload.emailId === "string") {
        await deliverEmail(payload.emailId);
        return;
      }
      if (payload.template === "season.ending") {
        await sendSeasonEndingEmail({
          email: String(payload.email ?? ""),
          username: String(payload.username ?? "pemain"),
          seasonId: String(payload.seasonId ?? ""),
          daysLeft: Number(payload.daysLeft ?? 7),
        });
        return;
      }
      if (typeof payload.orderId === "string" && typeof payload.template === "string") {
        await sendOrderEmail(payload.template as "order.created" | "order.paid" | "order.delivered", payload.orderId);
        return;
      }
      throw new Error(`Payload email tidak dikenali: ${JSON.stringify(payload)}`);
    }

    case "delivery.process": {
      if (typeof payload.deliveryId === "string") {
        await processDelivery(payload.deliveryId);
        return;
      }
      if (typeof payload.orderId === "string") {
        const rows = await db.select().from(deliveries).where(eq(deliveries.orderId, payload.orderId));
        for (const row of rows) {
          if (row.status === "DELIVERED") continue;
          await processDelivery(row.id);
        }
        return;
      }
      if (payload.allDue) {
        const due = await dueDeliveries(50);
        for (const row of due) await processDelivery(row.id);
        return;
      }
      throw new Error("Payload delivery.process kosong");
    }

    case "delivery.retry": {
      if (typeof payload.deliveryId !== "string") throw new Error("deliveryId wajib ada");
      await processDelivery(payload.deliveryId);
      return;
    }

    case "order.expire": {
      await expirePendingOrders();
      return;
    }

    case "payment.reconcile": {
      await reconcilePendingOrders();
      return;
    }

    case "season.reminders": {
      await sendSeasonReminders();
      return;
    }

    case "season.transition": {
      if (typeof payload.seasonId === "string") {
        await runSeasonTransition({ seasonId: payload.seasonId, reason: "job manual" });
      } else {
        await transitionDueSeasons();
      }
      return;
    }

    default:
      throw new Error(`Tipe job tidak dikenal: ${type}`);
  }
}

export async function runWorkerTick(state: TickState): Promise<TickResult> {
  const jobs = await claimJobs(WORKER_ID, 10);
  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await handleJob(job.type, job.payload);
      await completeJob(job.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      const message = (error as Error).message;
      logger.error("job_failed", { jobId: job.id, type: job.type, error: message, attempts: job.attempts });
      await failJob(job.id, message, job.attempts, job.maxAttempts);
    }
  }

  const now = Date.now();

  if (now - state.lastReconcile > 5 * 60_000) {
    state.lastReconcile = now;
    try {
      await expirePendingOrders();
      const result = await reconcilePendingOrders();
      if (result.checked > 0) logger.info("reconcile_done", result);
    } catch (error) {
      logger.warn("reconcile_error", { error: (error as Error).message });
    }
  }

  if (now - state.lastTransition > 10 * 60_000) {
    state.lastTransition = now;
    try {
      const results = await transitionDueSeasons();
      for (const result of results) logger.info("season_transition_cron", { ...result });
    } catch (error) {
      logger.warn("transition_error", { error: (error as Error).message });
    }
  }

  if (now - state.lastReminder > 60 * 60_000) {
    state.lastReminder = now;
    try {
      await sendSeasonReminders();
    } catch (error) {
      logger.warn("reminder_error", { error: (error as Error).message });
    }
  }

  await reclaimStaleJobs(10);
  return { processed, failed };
}


export function createTickState(): TickState {
  return { lastReconcile: 0, lastReminder: 0, lastTransition: 0 };
}

export type { TickState };
