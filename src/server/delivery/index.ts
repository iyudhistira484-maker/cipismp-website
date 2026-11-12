import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { deliveries, deliveryAttempts, jobs, notifications, orders, servers, users, type Delivery } from "../db/schema";
import { ids } from "../ids";
import { logger } from "../logger";
import { enqueue } from "../queue";
import { decryptSecret } from "../crypto";
import { getSettings } from "../settings";
import { alertStaff } from "../notifications";
import { execRconCommands } from "./rcon";
import { markOrderFailed } from "./order-failure";
import { containsRankChange, containsRankGrant, deliveryCommandsAreSafe, STAFF_RANK_DELIVERY_MESSAGE, UNSAFE_DELIVERY_MESSAGE } from "./command-safety";
import { knownStaffDeliveryQuery } from "../staff-rank";
import { env } from "../env";

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
  if (delivery.status === "DEAD") return { ok: false, error: "Pengiriman gagal permanen dan perlu ditinjau staf." };
  if (delivery.status === "SENT") return { ok: false, error: "Pengiriman sedang berlangsung atau hasilnya belum pasti; periksa sebelum mengirim ulang." };

  const settings = await getSettings();
  const server = await defaultServer();
  const started = Date.now();
  const commands = (delivery.commands as string[]) ?? [];

  if (commands.length === 0) {
    await finalizeFailure(delivery, "Tidak ada perintah untuk dijalankan", 0, settings.delivery.maxAttempts, true);
    return { ok: false, error: "Tidak ada perintah" };
  }

  if (!deliveryCommandsAreSafe(commands, delivery.playerName, delivery.uuid)) {
    await finalizeFailure(delivery, UNSAFE_DELIVERY_MESSAGE, 0, settings.delivery.maxAttempts, true, delivery.method);
    return { ok: false, error: UNSAFE_DELIVERY_MESSAGE };
  }

  if (server.deliveryMode === "PLUGIN") {
    // Plugin-hosted Minecraft servers poll the website over outbound HTTPS.
    // Leave the durable delivery QUEUED until the plugin claims and ACKs it.
    const safe = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(deliveries).where(eq(deliveries.id, delivery.id)).for("update").limit(1);
      if (!current || !["QUEUED", "FAILED"].includes(current.status)) return false;
      if (current.method === "RCON") {
        const [history] = await tx.select({ id: deliveryAttempts.id }).from(deliveryAttempts).where(eq(deliveryAttempts.deliveryId, current.id)).limit(1);
        if (history || current.leaseToken || current.attempts > 0) return false;
      }
      await tx.update(deliveries).set({ method: "PLUGIN", updatedAt: new Date() }).where(eq(deliveries.id, delivery.id));
      return true;
    });
    if (!safe) return { ok: false, error: "Pengiriman sedang berjalan atau pernah memakai RCON; rekonsiliasi manual diperlukan." };
    if (delivery.orderId) await markOrderDeliveredIfComplete(delivery.orderId);
    logger.info("delivery_waiting_for_plugin_poll", { deliveryId: delivery.id });
    return { ok: true, queuedForPluginPoll: true };
  }

  // RCON cannot establish an authenticated LoginSecurity session, even for kits.
  // Hold legacy work rather than executing or silently converting uncertain work.
  if (env.MINECRAFT_LOOKUP_MODE === "offline") {
    return { ok: false, error: "Server offline memerlukan plugin dan sesi LoginSecurity; RCON tidak diizinkan. Rekonsiliasi diperlukan." };
  }

  // Claim before opening RCON. If the worker dies after sending a command,
  // SENT remains uncertain and must be reconciled, never automatically retried.
  const token = randomUUID();
  const attemptNumber = delivery.attempts + 1;
  const claim = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(deliveries).where(eq(deliveries.id, delivery.id)).for("update").limit(1);
    if (!current || !["QUEUED", "FAILED"].includes(current.status) || current.attempts !== delivery.attempts) return "busy" as const;
    // A previous plugin poll may have left work on the Minecraft host, including
    // a QUEUED offline item with attempts reset to zero. Do not cross transports.
    if (current.method === "PLUGIN") {
      const [history] = await tx.select({ id: deliveryAttempts.id }).from(deliveryAttempts).where(eq(deliveryAttempts.deliveryId, current.id)).limit(1);
      if (history || current.leaseToken) return "uncertain" as const;
    }
    // Legacy RCON failures may already have applied commands. Manual reset only.
    if (current.method === "RCON" && current.status === "FAILED") return "uncertain" as const;
    if (containsRankGrant(current.commands)) {
      const result = await tx.execute(knownStaffDeliveryQuery(current.uuid, current.orderId));
      if (result.rows[0]?.restricted === true) return "staff" as const;
    }
    // RCON cannot check live LuckPerms memberships before applying a change.
    if (containsRankChange(current.commands)) return "rank-needs-plugin" as const;
    await tx.update(deliveries).set({ status: "SENT", method: "RCON", leaseToken: token, attempts: attemptNumber, updatedAt: new Date() }).where(eq(deliveries.id, current.id));
    return "claimed" as const;
  });
  if (claim === "staff" || claim === "rank-needs-plugin") {
    const error = claim === "staff" ? STAFF_RANK_DELIVERY_MESSAGE : "Perubahan rank melalui RCON ditahan; plugin LuckPerms diperlukan untuk pemeriksaan staf.";
    await finalizeFailure(delivery, error, 0, settings.delivery.maxAttempts, true, delivery.method);
    return { ok: false, error };
  }
  if (claim !== "claimed") return { ok: false, error: claim === "uncertain" ? "Pengiriman sebelumnya mungkin telah dijalankan atau tersimpan di plugin; rekonsiliasi manual diperlukan." : "Pengiriman sudah diproses oleh pekerja lain." };

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

  if (outcome.ok) {
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(deliveries).set({
        status: "DELIVERED", deliveredAt: new Date(), leaseToken: null, method,
        lastError: null, updatedAt: new Date(),
      }).where(and(eq(deliveries.id, delivery.id), eq(deliveries.status, "SENT"), eq(deliveries.leaseToken, token)))
        .returning({ id: deliveries.id });
      if (!row) return false;
      await tx.insert(deliveryAttempts).values({ id: ids.deliveryAttempt(), deliveryId: delivery.id, attempt: attemptNumber, ok: true, durationMs });
      return true;
    });
    if (!updated) return { ok: false, error: "Status pengiriman berubah saat RCON berjalan; perlu rekonsiliasi manual." };
    if (delivery.orderId) await markOrderDeliveredIfComplete(delivery.orderId);
    return outcome;
  }

  await finalizeFailure(
    { ...delivery, attempts: attemptNumber },
    outcome.error ?? "Pengiriman gagal",
    durationMs,
    settings.delivery.maxAttempts,
    true, // Any RCON error can mean commands were partially applied; do not auto-retry.
    method,
    token,
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
  leaseToken?: string,
): Promise<void> {
  const attempts = delivery.attempts ?? 0;
  const dead = permanent || attempts >= maxAttempts;
  const baseDelaySeconds = Number(process.env.DELIVERY_RETRY_BASE_SECONDS ?? 60);
  const delayMs = Math.min(baseDelaySeconds * 1000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);

  const now = new Date();
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(deliveries).set({
      status: dead ? "DEAD" : "FAILED", attempts, leaseToken: null, method,
      lastError: error.slice(0, 1000), nextAttemptAt: new Date(now.getTime() + delayMs), updatedAt: now,
    }).where(and(eq(deliveries.id, delivery.id), leaseToken ? and(eq(deliveries.status, "SENT"), eq(deliveries.leaseToken, leaseToken)) : inArray(deliveries.status, ["QUEUED", "FAILED"]))).returning({ id: deliveries.id });
    if (!row) return false;
    await tx.insert(deliveryAttempts).values({ id: ids.deliveryAttempt(), deliveryId: delivery.id, attempt: attempts, ok: false, error: error.slice(0, 1000), durationMs });
    if (dead && delivery.orderId) await markOrderFailed(tx, delivery.orderId, now);
    return true;
  });
  if (!updated) return;

  if (dead) {
    logger.error("delivery_dead", { deliveryId: delivery.id, error });
    await alertStaff({
      kind: "DELIVERY_DEAD",
      title: "Pengiriman gagal permanen",
      body: `Pengiriman ${delivery.id} untuk ${delivery.playerName ?? "pemain"} gagal: ${error}`,
      href: "/admin/pengiriman",
    });
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
  await db.transaction(async (tx) => {
    // Serialize finalization against disputes and concurrent ACKs. Never turn a
    // disputed/cancelled order back into a delivered one because of a late ACK.
    const [order] = await tx.select({ status: orders.status, userId: orders.userId, orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order || !["PAID", "DELIVERING", "FAILED"].includes(order.status)) return;
    const rows = await tx.select({ status: deliveries.status }).from(deliveries).where(eq(deliveries.orderId, orderId));
    if (rows.length === 0) return;
    if (!rows.every((row) => row.status === "DELIVERED")) {
      if (order.status === "PAID") await tx.update(orders).set({ status: "DELIVERING", updatedAt: new Date() }).where(eq(orders.id, orderId));
      return;
    }
    await tx.update(orders).set({ status: "DELIVERED", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderId));
    if (order.userId) {
      const [buyer] = await tx.select({ enabled: users.dashboardOrderUpdates }).from(users).where(eq(users.id, order.userId)).limit(1);
      if (buyer?.enabled) await tx.insert(notifications).values({ id: ids.notification(), userId: order.userId, kind: "ORDER_DELIVERED", title: "Pengiriman selesai", body: `Pengiriman ${order.orderNumber} telah dikonfirmasi server.`, href: `/dashboard/pesanan/${orderId}` });
    }
    await tx.insert(jobs).values({ id: ids.job(), type: "email.send", payload: { template: "order.delivered", orderId }, dedupeKey: `email-delivered:${orderId}` }).onConflictDoNothing({ target: jobs.dedupeKey });
  });
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

/** Only a failed delivery can be manually reset after operator reconciliation. */
export async function redeliver(deliveryId: string): Promise<DeliveryOutcome> {
  const reset = await db.transaction(async (tx) => {
    const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, deliveryId)).for("update").limit(1);
    if (!delivery || !["FAILED", "DEAD"].includes(delivery.status)) return false;
    const [server] = await tx.select({ deliveryMode: servers.deliveryMode }).from(servers).where(eq(servers.isDefault, true)).limit(1);
    if (!server) return false;
    if (delivery.method !== server.deliveryMode) {
      const [history] = await tx.select({ id: deliveryAttempts.id }).from(deliveryAttempts).where(eq(deliveryAttempts.deliveryId, delivery.id)).limit(1);
      if (history || delivery.leaseToken || delivery.attempts > 0) return false;
    }
    if (delivery.orderId) {
      const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, delivery.orderId)).for("update").limit(1);
      if (!order || !["PAID", "DELIVERING", "FAILED"].includes(order.status)) return false;
    }
    await tx.update(deliveries).set({ status: "QUEUED", attempts: 0, leaseToken: null, nextAttemptAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(deliveries.id, deliveryId));
    return true;
  });
  if (!reset) return { ok: false, error: "Hanya pengiriman gagal yang boleh diulang; periksa status pengiriman dan pesanan terlebih dahulu." };
  return processDelivery(deliveryId);
}
