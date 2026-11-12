import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, paymentEvents, payments } from "../db/schema";
import { ids } from "../ids";
import { logger } from "../logger";
import { alertStaff } from "../notifications";
import { fulfillPaidOrder, markOrderDisputed } from "../orders";
import { enqueue } from "../queue";
import { getAdapter, type ProviderId } from "./index";
import type { WebhookResult } from "./types";

export interface WebhookOutcome {
  httpStatus: number;
  result: string;
  duplicate: boolean;
}

/**
 * Memproses webhook gateway. Urutan penting:
 * 1. Signature diverifikasi lebih dulu (payload mentah, bukan hasil parse ulang).
 * 2. Event dicatat dengan `dedupeKey` unik → replay tidak pernah memproses ulang.
 * 3. Nominal dibandingkan dengan total order (tidak pernah mempercayai klien).
 * 4. Transisi status lewat `fulfillPaidOrder` yang mengunci baris order.
 */
export async function handleProviderWebhook(
  provider: ProviderId,
  rawBody: string,
  headers: Record<string, string>,
  ip: string | null,
): Promise<WebhookOutcome> {
  const adapter = await getAdapter(provider);
  const parsed: WebhookResult = await adapter.verifyWebhook(rawBody, headers);

  let eventId = ids.paymentEvent();
  // Event dengan signature tidak valid TIDAK boleh memakai dedupe key asli: bila dipakai,
  // penyerang bisa mengirim payload palsu lebih dulu dan memblokir event asli dari gateway.
  const dedupeKey = parsed.signatureValid ? parsed.dedupeKey : `INVALID:${parsed.dedupeKey}:${randomUUID()}`;
  const inserted = await db
    .insert(paymentEvents)
    .values({
      id: eventId,
      provider,
      eventType: parsed.eventType,
      signatureValid: parsed.signatureValid,
      dedupeKey,
      rawPayload: parsed.raw,
      headers,
      ip,
    })
    .onConflictDoNothing({ target: paymentEvents.dedupeKey })
    .returning({ id: paymentEvents.id });

  if (inserted.length === 0) {
    const previous = await db.query.paymentEvents.findFirst({ where: eq(paymentEvents.dedupeKey, dedupeKey) });
    if (!previous) throw new Error("Event pembayaran tidak ditemukan setelah konflik deduplikasi");
    if (previous.processedAt) {
      logger.info("webhook_duplicate_event", { provider, dedupeKey: parsed.dedupeKey });
      return { httpStatus: 200, result: "duplicate-event-ignored", duplicate: true };
    }
    // Retry an interrupted event. Fulfillment locks the order and is idempotent,
    // so simultaneous retries cannot create another entitlement/delivery.
    eventId = previous.id;
  }

  const finish = async (result: string, status = 200): Promise<WebhookOutcome> => {
    await db
      .update(paymentEvents)
      .set({ processedAt: new Date(), result })
      .where(eq(paymentEvents.id, eventId));
    return { httpStatus: status, result, duplicate: false };
  };

  if (!parsed.signatureValid) {
    logger.warn("webhook_invalid_signature", { provider, eventType: parsed.eventType, ip });
    return finish("invalid-signature", 401);
  }

  // Temukan order: utamakan merchant_ref (order number), fallback ke referensi pembayaran.
  let order = parsed.orderNumber
    ? await db.query.orders.findFirst({ where: eq(orders.orderNumber, parsed.orderNumber) })
    : undefined;

  let payment = parsed.providerRef
    ? await db.query.payments.findFirst({ where: eq(payments.providerRef, parsed.providerRef) })
    : undefined;

  // Midtrans Snap returns a token during creation, while callbacks identify the
  // transaction by a different ID. Only Midtrans may fall back to the order's
  // own payment; Tripay/FAKE references must match the stored payment.
  if (!payment && order && provider === "MIDTRANS") {
    const rows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, order.id), eq(payments.provider, provider)))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    payment = rows[0];
  }
  if (!order && payment) {
    order = await db.query.orders.findFirst({ where: eq(orders.id, payment.orderId) });
  }

  if (!order) {
    logger.error("webhook_order_not_found", { provider, orderNumber: parsed.orderNumber, providerRef: parsed.providerRef });
    await alertStaff({
      kind: "PAYMENT_ANOMALY",
      title: "Webhook tanpa order",
      body: `Webhook ${provider} diterima untuk referensi ${parsed.providerRef ?? "-"} / ${parsed.orderNumber ?? "-"} tetapi order tidak ditemukan.`,
      href: "/admin/pesanan",
    });
    return finish("order-not-found", 200);
  }

  await db.update(paymentEvents).set({ orderId: order.id }).where(eq(paymentEvents.id, eventId));

  if (!payment || payment.orderId !== order.id || payment.provider !== provider || order.provider !== provider) {
    await alertStaff({
      kind: "PAYMENT_ANOMALY",
      title: "Referensi pembayaran tidak cocok",
      body: `Webhook ${provider} untuk order ${order.orderNumber} tidak cocok dengan transaksi tersimpan. Periksa gateway sebelum memenuhi pesanan.`,
      href: `/admin/pesanan/${order.id}`,
    });
    return finish("payment-reference-mismatch");
  }

  switch (parsed.status) {
    case "PAID": {
      const expected = order.totalIdr;
      const paidAmount = parsed.amountIdr;
      if (paidAmount === null || !Number.isSafeInteger(paidAmount) || paidAmount < 0) {
        await alertStaff({ kind: "PAYMENT_ANOMALY", title: "Nominal pembayaran tidak tersedia", body: `Webhook ${provider} untuk ${order.orderNumber} tidak memiliki nominal valid. Periksa gateway sebelum memenuhi pesanan.`, href: `/admin/pesanan/${order.id}` });
        return finish("amount-unverified");
      }
      const flagCancelledPayment = async () => {
        await db.update(payments).set({ status: "PAID", amountIdr: paidAmount, paidAt: new Date(), updatedAt: new Date() }).where(eq(payments.id, payment.id));
        await alertStaff({ kind: "PAYMENT_ANOMALY", title: "Pembayaran untuk pesanan dibatalkan", body: `Pembayaran ${paidAmount} diterima untuk ${order.orderNumber} yang dibatalkan. Tinjau dan hubungi pembeli; tidak ada pengiriman otomatis.`, href: `/admin/pesanan/${order.id}` });
        return finish("cancelled-paid-review");
      };
      if (order.status === "CANCELLED") return flagCancelledPayment();

      if (paidAmount < expected) {
        if (payment) {
          await db
            .update(payments)
            .set({ status: "UNDERPAID", amountIdr: paidAmount, updatedAt: new Date(), paidAt: new Date() })
            .where(and(eq(payments.id, payment.id), inArray(payments.status, ["PENDING", "EXPIRED", "FAILED", "UNDERPAID"])));
        }
        await alertStaff({
          kind: "PAYMENT_ANOMALY",
          title: "Pembayaran kurang",
          body: `Order ${order.orderNumber}: callback melaporkan ${paidAmount}, seharusnya ${expected}. Periksa status order dan gateway sebelum tindakan manual; pembayaran yang sudah tercatat tidak diturunkan statusnya.`,
          href: `/admin/pesanan/${order.id}`,
        });
        return finish("underpaid-flagged");
      }

      if (paidAmount > expected && payment) {
        await db
          .update(payments)
          .set({ feeIdr: paidAmount - expected, updatedAt: new Date() })
          .where(eq(payments.id, payment.id));
        await alertStaff({
          kind: "PAYMENT_ANOMALY",
          title: "Pembayaran lebih",
          body: `Order ${order.orderNumber}: dibayar ${paidAmount}, seharusnya ${expected}. Item dikirim sekali; kelebihan ${paidAmount - expected} perlu ditinjau.`,
          href: `/admin/pesanan/${order.id}`,
        });
      }

      const fulfillment = await fulfillPaidOrder({
        orderId: order.id,
        paymentId: payment?.id ?? null,
        amountIdr: paidAmount,
        method: parsed.method,
      });

      if (fulfillment.cancelled) return flagCancelledPayment();
      if (fulfillment.alreadyPaid) {
        // A new callback for the same already-paid payment is not a second
        // payment. Check fresh state because another callback may have won.
        const currentPayment = await db.query.payments.findFirst({ where: eq(payments.id, payment.id) });
        if (currentPayment?.status === "PAID") return finish("payment-already-recorded");
        if (payment) {
          await db
            .update(payments)
            .set({ status: "DUPLICATE", updatedAt: new Date(), ...(parsed.method ? { method: parsed.method } : {}) })
            .where(eq(payments.id, payment.id));
        }
        await alertStaff({
          kind: "PAYMENT_ANOMALY",
          title: "Pembayaran ganda",
          body: `Order ${order.orderNumber} sudah lunas, tetapi ada pembayaran lagi (${parsed.providerRef ?? "tanpa ref"}). Tidak ada pengiriman kedua. Pertimbangkan comp bila pembeli membayar dua kali.`,
          href: `/admin/pesanan/${order.id}`,
        });
        return finish("duplicate-payment");
      }

      return finish("fulfilled");
    }

    case "DISPUTED": {
      await markOrderDisputed(order.id, parsed.reason ?? "chargeback dari gateway");
      if (payment) {
        await db.update(payments).set({ status: "DISPUTED", updatedAt: new Date() }).where(eq(payments.id, payment.id));
      }
      await alertStaff({
        kind: "DISPUTE",
        title: "Sengketa pembayaran",
        body: `Order ${order.orderNumber} ditandai DISPUTED oleh ${provider}. Tinjau bukti pengiriman dan putuskan pencabutan entitlement.`,
        href: `/admin/pesanan/${order.id}`,
      });
      return finish("disputed");
    }

    case "EXPIRED":
    case "FAILED": {
      if (payment && payment.status === "PENDING") {
        await db
          .update(payments)
          .set({ status: parsed.status === "EXPIRED" ? "EXPIRED" : "FAILED", updatedAt: new Date() })
          .where(eq(payments.id, payment.id));
      }
      return finish(`payment-${parsed.status.toLowerCase()}`);
    }

    case "PENDING":
    default:
      return finish("pending-ignored");
  }
}

/**
 * Rekonsiliasi: memeriksa order PENDING yang sudah berumur > 5 menit ke gateway.
 * Menangani webhook yang tidak pernah datang. Tidak pernah menandai lunas dari
 * sisi klien — hanya dari API gateway.
 */
export async function reconcilePendingOrders(limit = 25): Promise<{ checked: number; paid: number }> {
  const cutoff = new Date(Date.now() - 5 * 60_000);
  const candidates = await db
    .select()
    .from(orders)
    .where(and(inArray(orders.status, ["PENDING", "EXPIRED"]), lt(orders.createdAt, cutoff)))
    .orderBy(orders.createdAt)
    .limit(limit);

  let checked = 0;
  let paid = 0;

  for (const order of candidates) {
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    const payment = paymentRows[0];
    if (!payment || !["PENDING", "EXPIRED"].includes(payment.status)) continue;

    try {
      const adapter = await getAdapter(payment.provider);
      if (payment.provider === "FAKE") continue;
      const status = await adapter.getStatus(payment.providerRef, order.orderNumber);
      checked += 1;
      if (status.status === "PAID") {
        if (status.amountIdr === null || !Number.isSafeInteger(status.amountIdr) || status.amountIdr < order.totalIdr) {
          await alertStaff({ kind: "PAYMENT_ANOMALY", title: "Nominal rekonsiliasi perlu diperiksa", body: `Gateway melaporkan pembayaran ${order.orderNumber} tetapi nominal tidak valid atau kurang dari total. Tinjau sebelum memenuhi pesanan.`, href: `/admin/pesanan/${order.id}` });
          if (status.amountIdr !== null && Number.isSafeInteger(status.amountIdr) && status.amountIdr >= 0 && status.amountIdr < order.totalIdr) {
            await db.update(payments).set({ status: "UNDERPAID", amountIdr: status.amountIdr, updatedAt: new Date() }).where(eq(payments.id, payment.id));
          }
          continue;
        }
        const result = await fulfillPaidOrder({
          orderId: order.id,
          paymentId: payment.id,
          amountIdr: status.amountIdr,
          method: payment.method,
        });
        if (!result.alreadyPaid) {
          paid += 1;
          await db.insert(paymentEvents).values({
            id: ids.paymentEvent(),
            orderId: order.id,
            provider: payment.provider,
            eventType: "reconcile:status-check",
            signatureValid: true,
            dedupeKey: `RECONCILE:${payment.id}:${new Date().toISOString().slice(0, 13)}`,
            rawPayload: status.raw,
            processedAt: new Date(),
            result: "fulfilled-by-reconcile",
          });
        }
      } else if (status.status === "EXPIRED" || status.status === "FAILED") {
        await db
          .update(payments)
          .set({ status: status.status === "EXPIRED" ? "EXPIRED" : "FAILED", updatedAt: new Date() })
          .where(eq(payments.id, payment.id));
      }
    } catch (error) {
      logger.warn("reconcile_failed", { orderId: order.id, error: (error as Error).message });
    }
  }

  if (paid > 0) await enqueue("payment.reconcile", { followUp: true }, { runAt: new Date(Date.now() + 60_000) });
  return { checked, paid };
}

/** Statistik ringkas untuk health/monitoring. */
export async function paymentHealth(): Promise<{ pending: number; staleEvents: number }> {
  const pendingRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.status, "PENDING"));
  const staleRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentEvents)
    .where(sql`processed_at IS NULL AND received_at < now() - interval '10 minutes'`);
  return { pending: pendingRows[0]?.count ?? 0, staleEvents: staleRows[0]?.count ?? 0 };
}
