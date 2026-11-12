import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

export async function notificationPreferences(userId: string) {
  return db.query.users.findFirst({
    columns: { dashboardOrderUpdates: true, emailDeliveryUpdates: true },
    where: eq(users.id, userId),
  });
}

export async function updateNotificationPreferences(userId: string, input: { dashboardOrderUpdates: boolean; emailDeliveryUpdates: boolean }) {
  const rows = await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id });
  if (!rows.length) throw new Error("Akun tidak ditemukan.");
}
