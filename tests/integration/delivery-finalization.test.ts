import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { deliveries, jobs, notifications, orders, seasons, users } from "@/server/db/schema";
import { markOrderDeliveredIfComplete } from "@/server/delivery";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix();
const seasonId = `final-season-${suffix}`, orderId = `final-order-${suffix}`, deliveryId = `final-delivery-${suffix}`, userId = `final-user-${suffix}`;

describe.skipIf(!databaseUrl())("finalisasi pengiriman", () => {
  beforeAll(async () => {
    await db.insert(users).values({ id: userId, email: `user-${suffix}@example.test`, username: `final${suffix}`, passwordHash: "test" });
    await db.insert(seasons).values({ id: seasonId, name: "Final test", slug: seasonId, status: "UPCOMING", startAt: new Date(), endAt: new Date(Date.now() + 86400000) });
    await db.insert(orders).values({ id: orderId, orderNumber: orderId, publicToken: orderId, userId, email: `final-${suffix}@example.test`, mcUuid: "player", mcName: "Player", seasonId, status: "DISPUTED", subtotalIdr: 10000, totalIdr: 10000, expiresAt: new Date() });
    await db.insert(deliveries).values({ id: deliveryId, orderId, uuid: "player", playerName: "Player", productId: "product", status: "DELIVERED", commands: ["test"] });
  });
  afterAll(async () => {
    await db.delete(jobs).where(eq(jobs.dedupeKey, `email-delivered:${orderId}`));
    await db.delete(deliveries).where(eq(deliveries.id, deliveryId));
    await db.delete(orders).where(eq(orders.id, orderId));
    await db.delete(seasons).where(eq(seasons.id, seasonId));
    await db.delete(users).where(eq(users.id, userId));
  });
  it("tidak menimpa status sengketa karena ACK terlambat", async () => {
    await markOrderDeliveredIfComplete(orderId);
    expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId) }))?.status).toBe("DISPUTED");
    expect(await db.select().from(jobs).where(eq(jobs.dedupeKey, `email-delivered:${orderId}`))).toHaveLength(0);
  });
  it("menyelesaikan order dan membuat satu job email secara atomik meski finalisasi bersamaan", async () => {
    await db.update(orders).set({ status: "DELIVERING" }).where(eq(orders.id, orderId));
    await Promise.all([markOrderDeliveredIfComplete(orderId), markOrderDeliveredIfComplete(orderId)]);
    expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId) }))?.status).toBe("DELIVERED");
    expect(await db.select().from(jobs).where(eq(jobs.dedupeKey, `email-delivered:${orderId}`))).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.userId, userId))).toMatchObject([{ kind: "ORDER_DELIVERED", readAt: null }]);
  });
});
