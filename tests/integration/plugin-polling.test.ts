import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { deliveries, deliveryAttempts, pluginNonces, products, servers } from "@/server/db/schema";
import { computePluginSignature } from "@/server/delivery/plugin-auth";
import { verifyAndConsumePluginRequest } from "@/server/delivery/plugin-request";
import { acknowledgePluginDelivery, pollPluginDeliveries } from "@/server/delivery/polling";
import { processDelivery } from "@/server/delivery";
import { databaseUrl, uniqueSuffix } from "./helpers";

const enabled = databaseUrl() !== null;
const suffix = uniqueSuffix();
const serverId = `poll-server-${suffix}`;
const onlineDeliveryId = `poll-online-${suffix}`;
const retryDeliveryId = `poll-retry-${suffix}`;
const pluginNonce = `poll-nonce-${suffix}`;
let productId = "";
let previousDefaultServerIds: string[] = [];

async function addDelivery(id: string): Promise<void> {
  await db.insert(deliveries).values({
    id,
    uuid: "33333333-3333-4333-8333-333333333333",
    playerName: "CipiPollingTest",
    productId,
    method: "PLUGIN",
    status: "QUEUED",
    attempts: 0,
    nextAttemptAt: new Date(Date.now() - 1_000),
    commands: ["lp user CipiPollingTest parent set vip"],
  });
}

describe.skipIf(!enabled)("plugin delivery polling (HMAC, claim, ACK, retry)", () => {
  beforeAll(async () => {
    if (!enabled) return;
    previousDefaultServerIds = (await db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.isDefault, true))).map((row) => row.id);
    await db.update(servers).set({ isDefault: false }).where(eq(servers.isDefault, true));

    const product = await db.query.products.findFirst({ where: eq(products.slug, "cute-cipi") });
    if (!product) throw new Error("Produk cute-cipi harus tersedia dari migrasi 0008.");
    productId = product.id;

    await db.insert(servers).values({
      id: serverId,
      name: "Plugin polling integration test",
      isDefault: true,
      javaHost: "play.example.test",
      javaPort: 25565,
      bedrockHost: "bedrock.example.test",
      bedrockPort: 19132,
      deliveryMode: "PLUGIN",
    });
  });

  afterAll(async () => {
    if (!enabled) return;
    await db.delete(pluginNonces).where(eq(pluginNonces.nonce, pluginNonce));
    await db.delete(deliveryAttempts).where(inArray(deliveryAttempts.deliveryId, [onlineDeliveryId, retryDeliveryId]));
    await db.delete(deliveries).where(inArray(deliveries.id, [onlineDeliveryId, retryDeliveryId]));
    await db.delete(servers).where(eq(servers.id, serverId));
    if (previousDefaultServerIds.length > 0) {
      await db.update(servers).set({ isDefault: true }).where(inArray(servers.id, previousDefaultServerIds));
    }
  });

  it("memvalidasi HMAC dan menolak nonce yang dipakai ulang", async () => {
    const secret = process.env.PLUGIN_SHARED_SECRET!;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ version: "integration-test", limit: 1 });
    const signature = computePluginSignature({ secret, timestamp, nonce: pluginNonce, body });
    const createRequest = () => new Request("https://store.example.test/api/plugin/deliveries/poll", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cipi-timestamp": timestamp,
        "x-cipi-nonce": pluginNonce,
        "x-cipi-signature": signature,
      },
      body,
    });

    expect(await verifyAndConsumePluginRequest(createRequest())).toEqual({ ok: true, body });
    expect(await verifyAndConsumePluginRequest(createRequest())).toEqual({
      ok: false,
      status: 409,
      message: "Nonce sudah dipakai",
    });
  });

  it("mengklaim delivery secara lease dan menerima ACK sukses idempoten", async () => {
    await addDelivery(onlineDeliveryId);
    expect(await processDelivery(onlineDeliveryId)).toMatchObject({ ok: true, queuedForPluginPoll: true });
    const stillQueued = await db.query.deliveries.findFirst({ where: eq(deliveries.id, onlineDeliveryId) });
    expect(stillQueued?.status).toBe("QUEUED");

    const poll = await pollPluginDeliveries({ version: "test-1.2.3", limit: 10 });
    const claimed = poll.deliveries.find((delivery) => delivery.deliveryId === onlineDeliveryId);
    expect(poll.enabled).toBe(true);
    expect(claimed).toMatchObject({ deliveryId: onlineDeliveryId, attempt: 1, player: "CipiPollingTest" });
    expect(claimed?.leaseToken).toMatch(/^[0-9a-f-]{36}$/i);

    const row = await db.query.deliveries.findFirst({ where: eq(deliveries.id, onlineDeliveryId) });
    expect(row).toMatchObject({ status: "SENT", attempts: 1, method: "PLUGIN" });
    const heartbeat = await db.query.servers.findFirst({ where: eq(servers.id, serverId) });
    expect(heartbeat?.pluginVersion).toBe("test-1.2.3");
    expect(heartbeat?.pluginLastSeenAt).toBeInstanceOf(Date);

    const ack = {
      deliveryId: onlineDeliveryId,
      leaseToken: claimed!.leaseToken,
      attempt: 1,
      ok: true,
      applied: 1,
      queuedOffline: false,
      durationMs: 25,
    };
    expect(await acknowledgePluginDelivery(ack)).toMatchObject({ accepted: true, status: "DELIVERED" });
    expect(await acknowledgePluginDelivery(ack)).toMatchObject({ accepted: true, duplicate: true, status: "DELIVERED" });

    const attempts = await db.select().from(deliveryAttempts).where(eq(deliveryAttempts.deliveryId, onlineDeliveryId));
    expect(attempts).toHaveLength(1);
  });

  it("mengembalikan kegagalan ke retry setelah jeda dan mengklaim dengan nomor attempt baru", async () => {
    await addDelivery(retryDeliveryId);
    const firstPoll = await pollPluginDeliveries({ version: "test", limit: 10 });
    const firstClaim = firstPoll.deliveries.find((delivery) => delivery.deliveryId === retryDeliveryId);
    expect(firstClaim?.attempt).toBe(1);
    expect(firstClaim?.leaseToken).toBeTruthy();

    const failed = await acknowledgePluginDelivery({
      deliveryId: retryDeliveryId,
      leaseToken: firstClaim!.leaseToken,
      attempt: 1,
      ok: false,
      applied: 0,
      queuedOffline: false,
      error: "uji command failure",
      durationMs: 20,
    });
    expect(failed).toMatchObject({ accepted: true, status: "FAILED" });

    await db.update(deliveries)
      .set({ nextAttemptAt: new Date(Date.now() - 1_000) })
      .where(and(eq(deliveries.id, retryDeliveryId), eq(deliveries.status, "FAILED")));
    const secondPoll = await pollPluginDeliveries({ version: "test", limit: 10 });
    const secondClaim = secondPoll.deliveries.find((delivery) => delivery.deliveryId === retryDeliveryId);
    expect(secondClaim?.attempt).toBe(2);
    expect(secondClaim?.leaseToken).not.toBe(firstClaim!.leaseToken);
    expect(await acknowledgePluginDelivery({
      deliveryId: retryDeliveryId,
      leaseToken: firstClaim!.leaseToken,
      attempt: 1,
      ok: true,
      applied: 1,
      queuedOffline: false,
      durationMs: 20,
    })).toMatchObject({ accepted: false });

    expect(await acknowledgePluginDelivery({
      deliveryId: retryDeliveryId,
      leaseToken: secondClaim!.leaseToken,
      attempt: 2,
      ok: true,
      applied: 1,
      queuedOffline: false,
      durationMs: 20,
    })).toMatchObject({ accepted: true, status: "DELIVERED" });
  });
});
