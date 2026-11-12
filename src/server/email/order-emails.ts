import { eq } from "drizzle-orm";
import { db } from "../db";
import { orders, seasons } from "../db/schema";
import { notificationPreferences } from "../auth/notification-preferences";
import { getOrderDetail } from "../orders";
import { getSettings } from "../settings";
import { queueEmail } from "./index";
import {
  orderCreatedTemplate,
  orderDeliveredTemplate,
  orderFailedTemplate,
  orderPaidTemplate,
  seasonEndingTemplate,
  type OrderEmailData,
} from "./templates";

export type OrderEmailTemplate = "order.created" | "order.paid" | "order.delivered" | "order.disputed";

async function buildOrderEmailData(orderId: string): Promise<OrderEmailData | null> {
  const detail = await getOrderDetail(orderId);
  if (!detail || !detail.season) return null;
  const settings = await getSettings();
  const payment = detail.payments[0];
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return {
    orderNumber: detail.order.orderNumber,
    playerName: detail.order.mcName,
    seasonName: detail.season.name,
    seasonEndsAt: detail.season.endAt,
    subtotalIdr: detail.order.subtotalIdr,
    discountIdr: detail.order.discountIdr,
    discountLabel: detail.order.couponCode
      ? `Kupon ${detail.order.couponCode}`
      : detail.order.discountLabel
        ? `Otomatis ${detail.order.discountLabel}`
        : null,
    totalIdr: detail.order.totalIdr,
    items: detail.items.map((item) => ({
      name: item.nameSnapshot,
      type: item.type,
      amountIdr: item.lineTotalIdr,
    })),
    statusUrl: `${appUrl}/pesanan/${detail.order.publicToken}`,
    paymentUrl: payment?.checkoutUrl ?? null,
    method: payment?.method ?? null,
    payCode: payment?.payCode ?? null,
    expiresAt: detail.order.expiresAt,
    supportEmail: settings.site.supportEmail,
  } as OrderEmailData;
}

/** Mengirim email terkait order. Dipanggil dari worker agar tidak memblokir checkout. */
export async function sendOrderEmail(template: OrderEmailTemplate, orderId: string): Promise<void> {
  const detail = await getOrderDetail(orderId);
  if (!detail) return;
  const data = await buildOrderEmailData(orderId);
  if (!data) return;

  if (template === "order.disputed" || detail.order.status === "FAILED") {
    const content = orderFailedTemplate(data);
    await queueEmail({ to: detail.order.email, content });
    return;
  }

  switch (template) {
    case "order.created":
      await queueEmail({ to: detail.order.email, content: orderCreatedTemplate(data) });
      break;
    case "order.paid":
      await queueEmail({ to: detail.order.email, content: orderPaidTemplate(data) });
      break;
    case "order.delivered":
      // Transaction receipts and security emails remain mandatory; only the
      // optional successful-delivery update can be switched off by an account.
      if (detail.order.userId && (await notificationPreferences(detail.order.userId))?.emailDeliveryUpdates === false) return;
      await queueEmail({ to: detail.order.email, content: orderDeliveredTemplate(data) });
      break;
  }
}

export async function sendSeasonEndingEmail(input: {
  email: string;
  username: string;
  seasonId: string;
  daysLeft: number;
}): Promise<void> {
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, input.seasonId) });
  if (!season) return;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await queueEmail({
    to: input.email,
    content: seasonEndingTemplate({
      username: input.username,
      seasonName: season.name,
      endsAt: season.endAt,
      daysLeft: input.daysLeft,
      storeUrl: `${appUrl}/rank`,
    }),
  });
}

export async function sendOrderFailureNotice(orderId: string): Promise<void> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return;
  const data = await buildOrderEmailData(orderId);
  if (!data) return;
  await queueEmail({ to: order.email, content: orderFailedTemplate(data) });
}
