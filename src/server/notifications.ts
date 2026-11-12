import { and, desc, eq, isNull, like, or } from "drizzle-orm";
import { hasPermission, type Role } from "./rbac";
import { db } from "./db";
import { notifications } from "./db/schema";
import { ids } from "./ids";
import { logger } from "./logger";

type NotificationKindValue =
  | "ORDER_PAID"
  | "ORDER_DELIVERED"
  | "ORDER_FAILED"
  | "DISPUTE"
  | "PAYMENT_ANOMALY"
  | "DELIVERY_DEAD"
  | "SEASON_ENDING"
  | "SYSTEM";

/** Notifikasi in-app (bel notifikasi di dashboard admin/pemain). */
export async function notify(input: {
  userId?: string | null;
  kind: NotificationKindValue;
  title: string;
  body: string;
  href?: string;
}): Promise<void> {
  try {
    await db.insert(notifications).values({
      id: ids.notification(),
      userId: input.userId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
    });
  } catch (error) {
    logger.error("notification_failed", { error: (error as Error).message });
  }
}

export async function customerNotifications(userId: string, limit = 50) {
  return db.select({ id: notifications.id, title: notifications.title, body: notifications.body, href: notifications.href, readAt: notifications.readAt, createdAt: notifications.createdAt })
    .from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(Math.max(1, Math.min(limit, 50)));
}

/** Always scope updates to the authenticated owner, never trust an ID from the client. */
export async function markCustomerNotificationsRead(userId: string) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/** Shared operational feed, filtered before fetching by each staff role's permissions. */
export async function staffNotifications(role: Role) {
  const conditions = [];
  if (hasPermission(role, "orders.read")) conditions.push(like(notifications.href, "/admin/pesanan%"), like(notifications.href, "/admin/bantuan/%"));
  if (hasPermission(role, "delivery.read")) conditions.push(like(notifications.href, "/admin/pengiriman%"));
  if (hasPermission(role, "seasons.write")) conditions.push(like(notifications.href, "/admin/season%"));
  if (hasPermission(role, "products.write")) conditions.push(like(notifications.href, "/admin/ulasan%"));
  if (!conditions.length) return [];
  return db.select({ id: notifications.id, title: notifications.title, body: notifications.body, href: notifications.href, createdAt: notifications.createdAt })
    .from(notifications).where(and(isNull(notifications.userId), or(...conditions))).orderBy(desc(notifications.createdAt)).limit(50);
}

/** Peringatan operasional untuk seluruh staf (userId null = kotak admin). */
export async function alertStaff(input: {
  kind: NotificationKindValue;
  title: string;
  body: string;
  href?: string;
}): Promise<void> {
  await notify({ userId: null, ...input });
}
