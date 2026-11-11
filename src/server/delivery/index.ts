import { and, eq, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { deliveries, deliveryAttempts, orders, servers, type Delivery } from "../db/schema";
import { ids } from "../ids";
import { logger } from "../logger";
import { enqueue } from "../queue";
import { decryptSecret } from "../crypto";
import { getSettings } from "../settings";
import { alertStaff } from "../notifications";
import { execRconCommands } from "./rcon";

export interface DeliveryOutcome {
  ok: boolean;
  error?: string;
  queuedForNextJoin?: boolean;
  queuedForPluginPoll?: boolean;
}

async function defaultServer() {
  const row = await db.query.servers.findFirst({ where: eq(servers.isDefault, true) });
  if (!row) throw new Error("Server default belum dikonfigurasi di panel admin.");
  return row;
}

/** Eksekusi satu baris delivery. Idempoten: delivery yang sudah DELIVERED dilewati. */
export async function processDelivery(deliveryId: string): Promise<DeliveryOutcome> {
  const delivery = await db.query.deliveries.findFirst({ where: eq(deliveries.id, deliveryId) });
  if (!delivery) return { ok: false, error: "Delivery tidak ditemukan" };
  if (delivery.status === "DELIVERED") return { ok: true };

  const settings = await getSettings();
  const server = await defaultServer();
  const started = Date.now();
  const commands = (delivery.commands as string[]) ?? [];

  if (commands.length === 0) {
    await finalizeFailure(delivery, "Tidak ada perintah untuk dijalankan", 0, settings.delivery.maxAttempts, true);
    return { ok: false, error: "Tidak ada perintah" };
  }

  if (server.deliveryMode === "PLUGIN") {
    // Plugin-hosted Minecraft servers poll the website over outbound HTTPS.
    // Leave the durable delivery QUEUED until the plugin claims and ACKs it.
    await db.update(deliveries).set({ method: "PLUGIN", updatedAt: new Date() }).where(eq(deliveries.id, delivery.id));
    if (delivery.orderId) await markOrderDeliveredIfComplete(delivery.orderId);
    logger.info("delivery_waiting_for_plugin_poll", { deliveryId: delivery.id });
    return { ok: true, queuedForPluginPoll: true };
  }

  let outcome: DeliveryOutcome = { ok: false, error: "Metode pengiriman tidak tersedia" };
  const method: "PLUGIN" | "RCON" = "RCON";

  try {
    if (server.rconHost && server.rconPort) {
      const password = decryptSecret(server.rconPassword);
      if (!password) throw new Error("Password RCON belum diatur");
      await execRconCommands(
        { host: server.rconHost, port: server.rconPort, password },
        commands,
      );
      outcome = { ok: true };
    } else {
      throw new Error("Host/port/password RCON belum dikonfigurasi");
    }
  } catch (error) {
    outcome = { ok: false, error: (error as Error).message };
  }

  const durationMs = Date.now() - started;
  const attemptNumber = delivery.attempts + 1;

  await db.insert(deliveryAttempts).values({
    id: ids.deliveryAttempt(),
    deliveryId: delivery.id,
    attempt: attemptNumber,
    ok: outcome.ok,
    output: outcome.queuedForNextJoin ? "Diantrekan plugin sampai pemain login" : null,
    error: outcome.error ?? null,
    durationMs,
  });

  if (outcome.ok) {
    await db
      .update(deliveries)
      .set({
        status: "DELIVERED",
        deliveredAt: new Date(),
        attempts: attemptNumber,
        leaseToken: null,
        method,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, delivery.id));
    if (delivery.orderId) await markOrderDeliveredIfComplete(delivery.orderId);
    return outcome;
  }

  await finalizeFailure(
    { ...delivery, attempts: attemptNumber },
    outcome.error ?? "Pengiriman gagal",
    durationMs,
    settings.delivery.maxAttempts,
    false,
    method,
  );
  return outcome;
}

async function finalizeFailure(
  delivery: Partial<Delivery> & { id: string; attempts?: number },
  error: string,
  durationMs: number,
  maxAttempts: number,
  permanent: boolean,
  method: "PLUGIN" | "RCON" = "PLUGIN",
): Promise<void> {
  const attempts = delivery.attempts ?? 0;
  const dead = permanent || attempts >= maxAttempts;
  const baseDelaySeconds = Number(process.env.DELIVERY_RETRY_BASE_SECONDS ?? 60);
  const delayMs = Math.min(baseDelaySeconds * 1000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);

  await db
    .update(deliveries)
    .set({
      status: dead ? "DEAD" : "FAILED",
      attempts,
      leaseToken: null,
      method,
      lastError: error.slice(0, 1000),
      nextAttemptAt: new Date(Date.now() + delayMs),
      updatedAt: new Date(),
    })
    .where(eq(deliveries.id, delivery.id));

  if (durationMs > 0) {
    await db.insert(deliveryAttempts).values({
      id: ids.deliveryAttempt(),
      deliveryId: delivery.id,
      attempt: attempts,
      ok: false,
      error: error.slice(0, 1000),
      durationMs,
    });
  }

  if (dead) {
    logger.error("delivery_dead", { deliveryId: delivery.id, error });
    await alertStaff({
      kind: "DELIVERY_DEAD",
      title: "Pengiriman gagal permanen",
      body: `Pengiriman ${delivery.id} untuk ${delivery.playerName ?? "pemain"} gagal: ${error}`,
      href: "/admin/pengiriman",
    });
    if (delivery.orderId) {
      await db
        .update(orders)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(and(eq(orders.id, delivery.orderId), eq(orders.status, "DELIVERING")));
    }
  } else {
    await enqueue(
      "delivery.retry",
      { deliveryId: delivery.id },
      { runAt: new Date(Date.now() + delayMs), dedupeKey: `delivery-retry:${delivery.id}:${attempts}` },
    );
  }
}

/** Semua item terkirim → order DELIVERED. */
export async function markOrderDeliveredIfComplete(orderId: string): Promise<void> {
  const rows = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId));
  if (rows.length === 0) return;
  const allDone = rows.every((row) => row.status === "DELIVERED");
  if (!allDone) {
    await db
      .update(orders)
      .set({ status: "DELIVERING", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, "PAID")));
    return;
  }
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.status === "DELIVERED") return;

  await db
    .update(orders)
    .set({ status: "DELIVERED", deliveredAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  await enqueue("email.send", { template: "order.delivered", orderId }, { dedupeKey: `email-delivered:${orderId}` });
}

/** Ambil delivery yang siap dieksekusi (QUEUED atau FAILED yang sudah waktunya). */
export async function dueDeliveries(limit = 20) {
  return db
    .select()
    .from(deliveries)
    .where(
      and(
        or(eq(deliveries.status, "QUEUED"), eq(deliveries.status, "FAILED")),
        lte(deliveries.nextAttemptAt, new Date()),
      ),
    )
    .orderBy(deliveries.nextAttemptAt)
    .limit(limit);
}

export async function deliveryStats() {
  const rows = await db.execute(sql`
    SELECT status, count(*)::int AS count FROM deliveries GROUP BY status
  `);
  const map: Record<string, number> = {};
  for (const row of rows.rows as Array<{ status: string; count: number }>) map[row.status] = row.count;
  return map;
}

/** Reset manual dari panel admin; plugin mode akan diambil saat polling berikutnya. */
export async function redeliver(deliveryId: string): Promise<DeliveryOutcome> {
  await db
    .update(deliveries)
    .set({ status: "QUEUED", attempts: 0, leaseToken: null, nextAttemptAt: new Date(), lastError: null, updatedAt: new Date() })
    .where(eq(deliveries.id, deliveryId));
  return processDelivery(deliveryId);
}
