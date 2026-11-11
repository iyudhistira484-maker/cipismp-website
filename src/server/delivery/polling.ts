import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db } from "../db";
import { deliveries, deliveryAttempts, orders, servers } from "../db/schema";
import { ids } from "../ids";
import { alertStaff } from "../notifications";
import { getSettings } from "../settings";
import { logger } from "../logger";
import { markOrderDeliveredIfComplete } from "./index";

const MAX_POLL_BATCH = 10;
const DELIVERY_LEASE_MS = 3 * 60_000;
const LEASE_TIMEOUT_ERROR = "Plugin tidak mengonfirmasi pengiriman sebelum batas waktu.";

function retryDelayMs(attempt: number): number {
  const configured = Number(process.env.DELIVERY_RETRY_BASE_SECONDS ?? 60);
  const baseDelaySeconds = Number.isFinite(configured) ? Math.max(1, configured) : 60;
  return Math.min(baseDelaySeconds * 1000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000);
}

export interface ClaimedPluginDelivery {
  deliveryId: string;
  leaseToken: string;
  uuid: string;
  player: string;
  commands: string[];
  reason: "PURCHASE" | "SEASON_END";
  attempt: number;
}

export interface PluginPollResult {
  enabled: boolean;
  deliveries: ClaimedPluginDelivery[];
}

/** Record the plugin's outbound check-in, then atomically lease due deliveries. */
export async function pollPluginDeliveries(input: { version: string; limit: number }): Promise<PluginPollResult> {
  const server = await db.query.servers.findFirst({ where: eq(servers.isDefault, true) });
  if (!server) throw new Error("Server default belum dikonfigurasi di panel admin.");

  const now = new Date();
  await db
    .update(servers)
    .set({
      pluginLastSeenAt: now,
      pluginVersion: input.version.slice(0, 64) || null,
    })
    .where(eq(servers.id, server.id));

  if (server.deliveryMode !== "PLUGIN") return { enabled: false, deliveries: [] };

  const settings = await getSettings();
  const maxAttempts = Math.max(1, settings.delivery.maxAttempts);
  const batchSize = Math.max(1, Math.min(MAX_POLL_BATCH, Math.floor(input.limit) || 1));
  const leaseUntil = new Date(now.getTime() + DELIVERY_LEASE_MS);
  const dead: Array<{ id: string; playerName: string; orderId: string | null; error: string }> = [];

  const claimed = await db.transaction(async (tx) => {
    // Expired leases indicate the plugin crashed or lost its ACK. Record the timeout
    // and return the row to retry, or dead-letter it after the configured attempt limit.
    const expiredLeases = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.status, "SENT"), lte(deliveries.nextAttemptAt, now)))
      .orderBy(asc(deliveries.nextAttemptAt), asc(deliveries.createdAt))
      .limit(100)
      .for("update", { skipLocked: true });

    for (const delivery of expiredLeases) {
      const isDead = delivery.attempts >= maxAttempts;
      await tx.insert(deliveryAttempts).values({
        id: ids.deliveryAttempt(),
        deliveryId: delivery.id,
        attempt: delivery.attempts,
        ok: false,
        error: LEASE_TIMEOUT_ERROR,
        durationMs: DELIVERY_LEASE_MS,
      });
      await tx
        .update(deliveries)
        .set({
          status: isDead ? "DEAD" : "FAILED",
          lastError: LEASE_TIMEOUT_ERROR,
          nextAttemptAt: isDead ? now : new Date(now.getTime() + retryDelayMs(delivery.attempts)),
          updatedAt: now,
        })
        .where(eq(deliveries.id, delivery.id));

      if (isDead) {
        dead.push({ id: delivery.id, playerName: delivery.playerName, orderId: delivery.orderId, error: LEASE_TIMEOUT_ERROR });
        if (delivery.orderId) {
          await tx
            .update(orders)
            .set({ status: "FAILED", updatedAt: now })
            .where(and(eq(orders.id, delivery.orderId), inArray(orders.status, ["PAID", "DELIVERING"])));
        }
      }
    }

    const due = await tx
      .select()
      .from(deliveries)
      .where(
        and(
          inArray(deliveries.status, ["QUEUED", "FAILED"]),
          lte(deliveries.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(deliveries.nextAttemptAt), asc(deliveries.createdAt))
      .limit(batchSize)
      .for("update", { skipLocked: true });

    const output: ClaimedPluginDelivery[] = [];
    for (const delivery of due) {
      if (delivery.commands.length === 0) {
        const error = "Tidak ada perintah untuk dijalankan.";
        await tx
          .update(deliveries)
          .set({ status: "DEAD", lastError: error, updatedAt: now })
          .where(eq(deliveries.id, delivery.id));
        await tx.insert(deliveryAttempts).values({
          id: ids.deliveryAttempt(),
          deliveryId: delivery.id,
          attempt: delivery.attempts,
          ok: false,
          error,
          durationMs: 0,
        });
        dead.push({ id: delivery.id, playerName: delivery.playerName, orderId: delivery.orderId, error });
        if (delivery.orderId) {
          await tx
            .update(orders)
            .set({ status: "FAILED", updatedAt: now })
            .where(and(eq(orders.id, delivery.orderId), inArray(orders.status, ["PAID", "DELIVERING"])));
        }
        continue;
      }

      if (delivery.attempts >= maxAttempts) {
        const error = "Batas percobaan pengiriman tercapai.";
        await tx
          .update(deliveries)
          .set({ status: "DEAD", lastError: error, updatedAt: now })
          .where(eq(deliveries.id, delivery.id));
        dead.push({ id: delivery.id, playerName: delivery.playerName, orderId: delivery.orderId, error });
        if (delivery.orderId) {
          await tx
            .update(orders)
            .set({ status: "FAILED", updatedAt: now })
            .where(and(eq(orders.id, delivery.orderId), inArray(orders.status, ["PAID", "DELIVERING"])));
        }
        continue;
      }

      const attempt = delivery.attempts + 1;
      const leaseToken = randomUUID();
      await tx
        .update(deliveries)
        .set({
          status: "SENT",
          attempts: attempt,
          leaseToken,
          method: "PLUGIN",
          nextAttemptAt: leaseUntil,
          lastError: null,
          updatedAt: now,
        })
        .where(eq(deliveries.id, delivery.id));
      if (delivery.orderId) {
        await tx
          .update(orders)
          .set({ status: "DELIVERING", updatedAt: now })
          .where(and(eq(orders.id, delivery.orderId), eq(orders.status, "PAID")));
      }
      output.push({
        deliveryId: delivery.id,
        leaseToken,
        uuid: delivery.uuid,
        player: delivery.playerName,
        commands: delivery.commands,
        reason: delivery.seasonId && !delivery.orderId ? "SEASON_END" : "PURCHASE",
        attempt,
      });
    }
    return output;
  });

  for (const item of dead) {
    logger.error("plugin_delivery_dead", { deliveryId: item.id, error: item.error });
    await alertStaff({
      kind: "DELIVERY_DEAD",
      title: "Pengiriman gagal permanen",
      body: `Pengiriman ${item.id} untuk ${item.playerName} gagal: ${item.error}`,
      href: "/admin/pengiriman",
    });
  }

  return { enabled: true, deliveries: claimed };
}

export interface PluginDeliveryAck {
  deliveryId: string;
  leaseToken: string;
  attempt: number;
  ok: boolean;
  applied: number;
  queuedOffline: boolean;
  error?: string;
  durationMs: number;
}

export async function acknowledgePluginDelivery(input: PluginDeliveryAck): Promise<{
  accepted: boolean;
  duplicate?: boolean;
  status?: string;
  message?: string;
}> {
  const settings = await getSettings();
  const maxAttempts = Math.max(1, settings.delivery.maxAttempts);
  const now = new Date();
  const outcome = await db.transaction(async (tx) => {
    const [delivery] = await tx
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, input.deliveryId))
      .for("update")
      .limit(1);
    if (!delivery) return { accepted: false, message: "Pengiriman tidak ditemukan" };

    if (
      delivery.attempts === input.attempt
      && delivery.leaseToken === input.leaseToken
      && ["DELIVERED", "FAILED", "DEAD"].includes(delivery.status)
    ) {
      return { accepted: true, duplicate: true, status: delivery.status, orderId: delivery.orderId };
    }
    if (
      delivery.status !== "SENT"
      || delivery.attempts !== input.attempt
      || !delivery.leaseToken
      || delivery.leaseToken !== input.leaseToken
    ) {
      return { accepted: false, message: "ACK kedaluwarsa atau tidak sesuai lease" };
    }

    if (input.ok) {
      const output = input.queuedOffline
        ? "Perintah disimpan plugin sampai pemain login."
        : `Perintah dijalankan (${input.applied} berhasil).`;
      await tx
        .update(deliveries)
        .set({ status: "DELIVERED", deliveredAt: now, lastError: null, updatedAt: now })
        .where(eq(deliveries.id, delivery.id));
      await tx.insert(deliveryAttempts).values({
        id: ids.deliveryAttempt(),
        deliveryId: delivery.id,
        attempt: input.attempt,
        ok: true,
        output,
        durationMs: input.durationMs,
      });
      return { accepted: true, status: "DELIVERED", orderId: delivery.orderId };
    }

    const error = (input.error || "Plugin gagal menjalankan perintah").slice(0, 1000);
    const isDead = input.attempt >= maxAttempts;
    const nextAttemptAt = new Date(now.getTime() + retryDelayMs(input.attempt));
    await tx
      .update(deliveries)
      .set({
        status: isDead ? "DEAD" : "FAILED",
        lastError: error,
        nextAttemptAt,
        updatedAt: now,
      })
      .where(eq(deliveries.id, delivery.id));
    await tx.insert(deliveryAttempts).values({
      id: ids.deliveryAttempt(),
      deliveryId: delivery.id,
      attempt: input.attempt,
      ok: false,
      error,
      durationMs: input.durationMs,
    });
    if (isDead && delivery.orderId) {
      await tx
        .update(orders)
        .set({ status: "FAILED", updatedAt: now })
        .where(and(eq(orders.id, delivery.orderId), inArray(orders.status, ["PAID", "DELIVERING"])));
    }
    return { accepted: true, status: isDead ? "DEAD" : "FAILED", orderId: delivery.orderId, dead: isDead, error, playerName: delivery.playerName };
  });

  if (outcome.accepted && outcome.status === "DELIVERED" && outcome.orderId) {
    await markOrderDeliveredIfComplete(outcome.orderId);
  }
  if ("dead" in outcome && outcome.dead) {
    logger.error("plugin_delivery_dead", { deliveryId: input.deliveryId, error: outcome.error });
    await alertStaff({
      kind: "DELIVERY_DEAD",
      title: "Pengiriman gagal permanen",
      body: `Pengiriman ${input.deliveryId} untuk ${outcome.playerName} gagal: ${outcome.error}`,
      href: "/admin/pengiriman",
    });
  }
  return outcome;
}
