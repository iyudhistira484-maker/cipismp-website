import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "@/server/db";
import { deliveries, deliveryAttempts, notifications, orders, seasons, servers, users } from "@/server/db/schema";
import { encryptSecret } from "@/server/crypto";
import { getSettings } from "@/server/settings";
import { processDelivery, redeliver } from "@/server/delivery";
import { pollPluginDeliveries } from "@/server/delivery/polling";
import { markOrderFailed } from "@/server/delivery/order-failure";
import { execRconCommands } from "@/server/delivery/rcon";
import { databaseUrl, uniqueSuffix } from "./helpers";

vi.mock("@/server/delivery/rcon", () => ({ execRconCommands: vi.fn().mockRejectedValue(new Error("rahasia server tidak boleh tampil")) }));
const suffix = uniqueSuffix(), user = `failure-user-${suffix}`, quiet = `failure-quiet-${suffix}`, season = `failure-season-${suffix}`, server = `failure-server-${suffix}`;
const names = ["timeout", "empty", "exhausted", "rcon", "quiet", "disputed", "parallel", "concurrent", "uncertain", "offline", "unsafe", "staff", "rank-rcon"];
const orderId = (name: string) => `failure-order-${suffix}-${name}`;
const deliveryId = (name: string) => `failure-delivery-${suffix}-${name}`;
let previousServerIds: string[] = [];

describe.skipIf(!databaseUrl())("pemberitahuan kegagalan pengiriman", () => {
  beforeAll(async () => {
    previousServerIds = (await db.select({ id: servers.id }).from(servers).where(eq(servers.isDefault, true))).map((row) => row.id);
    await db.update(servers).set({ isDefault: false }).where(eq(servers.isDefault, true));
    await db.insert(servers).values({ id: server, name: "Failure test", isDefault: true, javaHost: "example.test", bedrockHost: "example.test", deliveryMode: "PLUGIN" });
    await db.insert(users).values([{ id: user, email: `${user}@example.test`, username: `fail${suffix}`, passwordHash: "test" }, { id: quiet, email: `${quiet}@example.test`, username: `quiet${suffix}`, passwordHash: "test", dashboardOrderUpdates: false }]);
    await db.insert(seasons).values({ id: season, name: "Failure test", slug: season, status: "UPCOMING", startAt: new Date(), endAt: new Date(Date.now() + 86400000) });
    await db.insert(orders).values(names.map((name) => ({ id: orderId(name), orderNumber: orderId(name), publicToken: orderId(name), userId: name === "quiet" ? quiet : user, email: `${user}@example.test`, mcUuid: "test", mcName: "Test", seasonId: season, subtotalIdr: 10000, totalIdr: 10000, status: name === "disputed" ? "DISPUTED" as const : "DELIVERING" as const, expiresAt: new Date() })));
    const max = (await getSettings()).delivery.maxAttempts;
    await db.insert(deliveries).values([
      { id: deliveryId("timeout"), orderId: orderId("timeout"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "SENT", attempts: max, nextAttemptAt: new Date(Date.now() - 1000), commands: ["lp user Player permission set playerkits.kits.cipiprime true"] },
      { id: deliveryId("empty"), orderId: orderId("empty"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", commands: [] },
      { id: deliveryId("exhausted"), orderId: orderId("exhausted"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", attempts: max, commands: ["lp user Player permission set playerkits.kits.cipiprime true"] },
      { id: deliveryId("rcon"), orderId: orderId("rcon"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", attempts: 0, commands: ["lp user Player permission set playerkits.kits.cipiprime true"] },
      { id: deliveryId("quiet"), orderId: orderId("quiet"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", commands: [] },
      { id: deliveryId("disputed"), orderId: orderId("disputed"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", commands: [] },
      { id: deliveryId("concurrent"), orderId: orderId("concurrent"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", nextAttemptAt: new Date(Date.now() + 3600000), commands: ["lp user Player permission set playerkits.kits.cipiprime true"] },
      { id: deliveryId("uncertain"), orderId: orderId("uncertain"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "SENT", method: "RCON", attempts: 1, leaseToken: "previous-worker", nextAttemptAt: new Date(Date.now() - 1000), commands: ["lp user Player permission set playerkits.kits.cipiprime true"] },
      { id: deliveryId("offline"), orderId: orderId("offline"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", method: "PLUGIN", attempts: 0, leaseToken: "offline-queue-token", nextAttemptAt: new Date(Date.now() + 3600000), commands: ["lp user Player permission set playerkits.kits.cipiprime true"] },
    ]);
  });
  afterAll(async () => {
    await db.delete(notifications).where(inArray(notifications.href, names.map((name) => `/dashboard/pesanan/${orderId(name)}`)));
    await db.delete(notifications).where(and(eq(notifications.href, "/admin/pengiriman"), like(notifications.body, `%${suffix}%`)));
    await db.delete(orders).where(inArray(orders.id, names.map(orderId)));
    await db.delete(seasons).where(eq(seasons.id, season));
    await db.delete(users).where(inArray(users.id, [user, quiet]));
    await db.delete(servers).where(eq(servers.id, server));
    if (previousServerIds.length) await db.update(servers).set({ isDefault: true }).where(inArray(servers.id, previousServerIds));
  });
  it("timeout, perintah kosong dan retry habis memberitahu pemilik satu kali tanpa detail internal", async () => {
    // Keep RCON fixture out of this poll's due batch.
    await db.update(deliveries).set({ nextAttemptAt: new Date(Date.now() + 3600000) }).where(eq(deliveries.id, deliveryId("rcon")));
    await pollPluginDeliveries({ version: "test", limit: 10 });
    await pollPluginDeliveries({ version: "test", limit: 10 });
    for (const name of ["timeout", "empty", "exhausted"]) {
      expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId(name)) }))?.status).toBe("FAILED");
      const messages = await db.select().from(notifications).where(eq(notifications.href, `/dashboard/pesanan/${orderId(name)}`));
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ userId: user, kind: "ORDER_FAILED" });
      expect(messages[0]?.body).not.toMatch(/tidak ada perintah|sebelum batas waktu|rahasia server/i);
    }
    expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId("quiet")) }))?.status).toBe("FAILED");
    expect(await db.select().from(notifications).where(eq(notifications.href, `/dashboard/pesanan/${orderId("quiet")}`))).toHaveLength(0);
    expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId("disputed")) }))?.status).toBe("DISPUTED");
    expect(await db.select().from(notifications).where(eq(notifications.href, `/dashboard/pesanan/${orderId("disputed")}`))).toHaveLength(0);
    expect((await redeliver(deliveryId("disputed"))).ok).toBe(false);
  });
  it("kegagalan RCON dicatat satu kali dan memberi notifikasi aman", async () => {
    vi.mocked(execRconCommands).mockRejectedValue(new Error("rahasia server tidak boleh tampil"));
    await db.update(servers).set({ deliveryMode: "RCON", rconHost: "example.test", rconPort: 25575, rconPassword: encryptSecret("test-only") }).where(eq(servers.id, server));
    await processDelivery(deliveryId("rcon"));
    await processDelivery(deliveryId("rcon"));
    expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId("rcon")) }))?.status).toBe("FAILED");
    expect((await db.query.deliveries.findFirst({ where: eq(deliveries.id, deliveryId("rcon")) }))?.status).toBe("DEAD");
    expect(await db.select().from(deliveryAttempts).where(eq(deliveryAttempts.deliveryId, deliveryId("rcon")))).toHaveLength(1);
    const messages = await db.select().from(notifications).where(eq(notifications.href, `/dashboard/pesanan/${orderId("rcon")}`));
    expect(messages).toHaveLength(1);
    expect(messages[0]?.body).not.toMatch(/rahasia/i);
  });
  it("RCON menahan perintah berbahaya dan rank bagi pembeli yang menjadi staf setelah checkout", async () => {
    vi.mocked(execRconCommands).mockClear();
    await db.insert(deliveries).values([
      { id: deliveryId("unsafe"), orderId: orderId("unsafe"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", commands: ["lp user Player parent set vip"] },
      { id: deliveryId("staff"), orderId: orderId("staff"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", commands: ["lp user Player parent add vip"] },
      { id: deliveryId("rank-rcon"), orderId: orderId("rank-rcon"), uuid: "33333333-3333-4333-8333-333333333333", playerName: "Player", productId: "p", status: "QUEUED", commands: ["lp user Player parent remove vip"] },
    ]);
    expect((await processDelivery(deliveryId("rank-rcon"))).ok).toBe(false);
    expect((await db.query.deliveries.findFirst({ where: eq(deliveries.id, deliveryId("rank-rcon")) }))?.status).toBe("DEAD");
    await db.update(users).set({ role: "SUPPORT" }).where(eq(users.id, user));
    try {
      expect((await processDelivery(deliveryId("unsafe"))).ok).toBe(false);
      expect((await processDelivery(deliveryId("staff"))).ok).toBe(false);
      expect(execRconCommands).not.toHaveBeenCalled();
      expect(await db.query.deliveries.findFirst({ where: eq(deliveries.id, deliveryId("staff")) })).toMatchObject({ status: "DEAD" });
    } finally {
      await db.update(users).set({ role: "CUSTOMER" }).where(eq(users.id, user));
    }
  });
  it("antrean offline plugin tidak dapat otomatis diulang lewat RCON", async () => {
    vi.mocked(execRconCommands).mockClear();
    expect((await processDelivery(deliveryId("offline"))).ok).toBe(false);
    expect(execRconCommands).not.toHaveBeenCalled();
    expect(await db.query.deliveries.findFirst({ where: eq(deliveries.id, deliveryId("offline")) })).toMatchObject({ status: "QUEUED", method: "PLUGIN" });
  });
  it("claim RCON bersamaan menjalankan perintah satu kali dan SENT tidak di-reset", async () => {
    let release!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const blocker = new Promise<string[]>((resolve) => { release = () => resolve(["ok"]); });
    vi.mocked(execRconCommands).mockClear().mockImplementation(async () => { started(); return blocker; });
    const first = processDelivery(deliveryId("concurrent"));
    await entered;
    const second = await processDelivery(deliveryId("concurrent"));
    expect(second.ok).toBe(false);
    expect((await redeliver(deliveryId("concurrent"))).ok).toBe(false);
    release();
    expect((await first).ok).toBe(true);
    expect(execRconCommands).toHaveBeenCalledTimes(1);
    expect((await redeliver(deliveryId("concurrent"))).ok).toBe(false);
  });
  it("SENT RCON dengan hasil tidak pasti tidak diretry atau direbut polling plugin", async () => {
    expect((await processDelivery(deliveryId("uncertain"))).ok).toBe(false);
    expect((await redeliver(deliveryId("uncertain"))).ok).toBe(false);
    await db.update(servers).set({ deliveryMode: "PLUGIN" }).where(eq(servers.id, server));
    await pollPluginDeliveries({ version: "test", limit: 10 });
    expect(await db.query.deliveries.findFirst({ where: eq(deliveries.id, deliveryId("uncertain")) })).toMatchObject({ status: "SENT", method: "RCON", attempts: 1 });
  });
  it("transisi bersamaan hanya membuat satu notifikasi", async () => {
    await Promise.all([db.transaction((tx) => markOrderFailed(tx, orderId("parallel"), new Date())), db.transaction((tx) => markOrderFailed(tx, orderId("parallel"), new Date()))]);
    expect(await db.select().from(notifications).where(eq(notifications.href, `/dashboard/pesanan/${orderId("parallel")}`))).toHaveLength(1);
  });
});
