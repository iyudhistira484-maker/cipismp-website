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

/** Peringatan operasional untuk seluruh staf (userId null = kotak admin). */
export async function alertStaff(input: {
  kind: NotificationKindValue;
  title: string;
  body: string;
  href?: string;
}): Promise<void> {
  await notify({ userId: null, ...input });
}
