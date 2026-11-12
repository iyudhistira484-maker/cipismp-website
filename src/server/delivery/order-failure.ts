import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { notifications, orders, users } from "../db/schema";
import { ids } from "../ids";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Call in the same transaction as a permanent delivery failure. */
export async function markOrderFailed(tx: Transaction, orderId: string, now: Date): Promise<boolean> {
  const [order] = await tx.update(orders).set({ status: "FAILED", updatedAt: now })
    .where(and(eq(orders.id, orderId), inArray(orders.status, ["PAID", "DELIVERING"])))
    .returning({ userId: orders.userId, orderNumber: orders.orderNumber });
  if (!order) return false;
  if (order.userId) {
    const [buyer] = await tx.select({ enabled: users.dashboardOrderUpdates }).from(users).where(eq(users.id, order.userId)).limit(1);
    if (buyer?.enabled) await tx.insert(notifications).values({ id: ids.notification(), userId: order.userId, kind: "ORDER_FAILED", title: "Pengiriman perlu bantuan", body: `Pengiriman ${order.orderNumber} belum berhasil. Hubungi bantuan dengan nomor pesanan; tidak perlu membayar lagi.`, href: `/dashboard/pesanan/${orderId}` });
  }
  return true;
}
