import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { emailOutbox, entitlements, minecraftProfiles, notifications, orders, products, seasons, users } from "@/server/db/schema";
import { notificationPreferences, updateNotificationPreferences } from "@/server/auth/notification-preferences";
import { sendOrderEmail } from "@/server/email/order-emails";
import { entitlementsForUser } from "@/server/entitlements";
import { customerNotifications, markCustomerNotificationsRead } from "@/server/notifications";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix();
const id = `dashboard-${suffix}`, other = `dashboard-other-${suffix}`, season = `season-dashboard-${suffix}`, product = `product-dashboard-${suffix}`, order = `order-dashboard-${suffix}`;
const email = `dashboard-${suffix}@example.test`;
const uuid = `00000000-0000-4000-8000-${suffix.replace(/-/g, "").padEnd(12, "0")}`;

describe.skipIf(!databaseUrl())("fitur dashboard pelanggan", () => {
  beforeAll(async () => {
    await db.insert(users).values([{ id, email, username: `dash${suffix}`, passwordHash: "test" }, { id: other, email: `other-${email}`, username: `other${suffix}`, passwordHash: "test" }]);
    await db.insert(seasons).values({ id: season, name: "Season test", slug: season, status: "ACTIVE", startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 86400000) });
    await db.insert(products).values({ id: product, name: "Rank test", slug: product, type: "RANK", tagline: "test", description: "test", priceIdr: 10000 });
    await db.insert(minecraftProfiles).values({ id: `profile-${suffix}`, uuid, displayName: "PlayerTest", edition: "JAVA", userId: id });
    await db.insert(entitlements).values({ id: `ent-${suffix}`, uuid, productId: product, seasonId: season, active: true });
    await db.insert(orders).values({ id: order, orderNumber: order, publicToken: order, userId: id, email, mcUuid: uuid, mcName: "PlayerTest", seasonId: season, status: "DELIVERED", subtotalIdr: 10000, totalIdr: 10000, expiresAt: new Date(Date.now() + 60000) });
  });
  afterAll(async () => {
    await db.delete(emailOutbox).where(eq(emailOutbox.to, email));
    await db.delete(orders).where(eq(orders.id, order));
    await db.delete(entitlements).where(eq(entitlements.productId, product));
    await db.delete(minecraftProfiles).where(eq(minecraftProfiles.uuid, uuid));
    await db.delete(products).where(eq(products.id, product));
    await db.delete(seasons).where(eq(seasons.id, season));
    await db.delete(users).where(eq(users.id, id));
    await db.delete(users).where(eq(users.id, other));
  });
  it("hanya menampilkan hak setelah profil terverifikasi dan tidak ke akun lain", async () => {
    expect(await entitlementsForUser(id)).toHaveLength(0);
    await db.update(minecraftProfiles).set({ verifiedAt: new Date() }).where(eq(minecraftProfiles.uuid, uuid));
    expect(await entitlementsForUser(id)).toMatchObject([{ productId: product, active: true }]);
    expect(await entitlementsForUser(other)).toHaveLength(0);
  });
  it("notifikasi dan tanda dibaca terisolasi per akun", async () => {
    await db.insert(notifications).values([{ id: `notice-a-${suffix}`, userId: id, kind: "ORDER_PAID", title: "A", body: "A" }, { id: `notice-b-${suffix}`, userId: other, kind: "ORDER_PAID", title: "B", body: "B" }]);
    expect(await customerNotifications(id)).toMatchObject([{ title: "A", readAt: null }]);
    await markCustomerNotificationsRead(id);
    expect((await customerNotifications(id))[0]?.readAt).toBeInstanceOf(Date);
    expect((await customerNotifications(other))[0]?.readAt).toBeNull();
  });
  it("preferensi terpisah per akun dan hanya menonaktifkan email pengiriman opsional", async () => {
    expect(await notificationPreferences(id)).toEqual({ dashboardOrderUpdates: true, emailDeliveryUpdates: true });
    await updateNotificationPreferences(id, { dashboardOrderUpdates: false, emailDeliveryUpdates: false });
    expect(await notificationPreferences(other)).toEqual({ dashboardOrderUpdates: true, emailDeliveryUpdates: true });
    await sendOrderEmail("order.delivered", order);
    expect(await db.select().from(emailOutbox).where(eq(emailOutbox.to, email))).toHaveLength(0);
    await sendOrderEmail("order.paid", order);
    expect(await db.select().from(emailOutbox).where(eq(emailOutbox.to, email))).toHaveLength(1);
    await updateNotificationPreferences(id, { dashboardOrderUpdates: true, emailDeliveryUpdates: true });
    await sendOrderEmail("order.delivered", order);
    expect(await db.select().from(emailOutbox).where(eq(emailOutbox.to, email))).toHaveLength(2);
  });
});
