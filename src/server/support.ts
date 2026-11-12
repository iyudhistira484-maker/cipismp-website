import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { notifications, orders, supportMessages, supportTickets, users } from "./db/schema";
import { ids } from "./ids";
import { cursorCondition, cursorOrder, cursorPage, cursorTimestamp, decodeCursor, PAGE_SIZE } from "./pagination";

export class SupportError extends Error {}

function clean(value: string, min: number, max: number, label: string): string {
  const result = value.trim();
  if (result.length < min || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) {
    throw new SupportError(`${label} harus ${min}–${max} karakter.`);
  }
  return result;
}

export async function createSupportTicket(userId: string, input: { subject: string; body: string; orderId?: string | null }) {
  const subject = clean(input.subject, 5, 120, "Judul");
  const body = clean(input.body, 10, 3000, "Pesan");
  const orderId = input.orderId || null;
  const ticketId = ids.supportTicket();
  await db.transaction(async (tx) => {
    if (orderId) {
      const [owned] = await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
      if (!owned) throw new SupportError("Pesanan tidak ditemukan pada akun ini.");
    }
    await tx.insert(supportTickets).values({ id: ticketId, userId, orderId, subject });
    await tx.insert(supportMessages).values({ id: ids.supportMessage(), ticketId, authorId: userId, authorRole: "CUSTOMER", body });
    await tx.insert(notifications).values({ id: ids.notification(), kind: "SYSTEM", title: "Permintaan bantuan baru", body: "Pelanggan mengirim permintaan bantuan baru.", href: `/admin/bantuan/${ticketId}` });
  });
  return ticketId;
}

export async function replySupportTicket(ticketId: string, actor: { id: string; staff: boolean }, rawBody: string) {
  const body = clean(rawBody, 2, 3000, "Pesan");
  await db.transaction(async (tx) => {
    const [ticket] = await tx.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1).for("update");
    if (!ticket || (!actor.staff && ticket.userId !== actor.id)) throw new SupportError("Permintaan bantuan tidak ditemukan.");
    if (ticket.status !== "OPEN") throw new SupportError("Permintaan sudah ditutup. Buat permintaan baru bila masih perlu bantuan.");
    const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(supportMessages).where(eq(supportMessages.ticketId, ticketId));
    if ((count?.n ?? 0) >= 200) throw new SupportError("Percakapan sudah mencapai batas. Buat permintaan baru.");
    await tx.insert(supportMessages).values({ id: ids.supportMessage(), ticketId, authorId: actor.id, authorRole: actor.staff ? "STAFF" : "CUSTOMER", body });
    await tx.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
    if (actor.staff) {
      await tx.insert(notifications).values({ id: ids.notification(), userId: ticket.userId, kind: "SYSTEM", title: "Balasan bantuan", body: `Tim bantuan membalas: ${ticket.subject}`, href: `/dashboard/bantuan/${ticketId}` });
    } else {
      await tx.insert(notifications).values({ id: ids.notification(), kind: "SYSTEM", title: "Balasan pelanggan", body: "Pelanggan membalas permintaan bantuan.", href: `/admin/bantuan/${ticketId}` });
    }
  });
}

export async function closeSupportTicket(ticketId: string) {
  await db.transaction(async (tx) => {
    const [ticket] = await tx.update(supportTickets).set({ status: "CLOSED", updatedAt: new Date() }).where(and(eq(supportTickets.id, ticketId), eq(supportTickets.status, "OPEN"))).returning({ id: supportTickets.id, userId: supportTickets.userId, subject: supportTickets.subject });
    if (!ticket) throw new SupportError("Permintaan tidak ditemukan atau sudah ditutup.");
    await tx.insert(notifications).values({ id: ids.notification(), userId: ticket.userId, kind: "SYSTEM", title: "Permintaan bantuan ditutup", body: `Tim menutup permintaan: ${ticket.subject}`, href: `/dashboard/bantuan/${ticketId}` });
  });
}

export async function supportOrderForUser(userId: string, orderId: string) {
  const [order] = await db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.id, orderId))).limit(1);
  return order ?? null;
}

export async function customerTickets(userId: string, rawCursor?: string) {
  const cursor = decodeCursor(rawCursor);
  const rows = await db.select({ id: supportTickets.id, cursorAt: cursorTimestamp(supportTickets.updatedAt), subject: supportTickets.subject, status: supportTickets.status, updatedAt: supportTickets.updatedAt, orderNumber: orders.orderNumber })
    .from(supportTickets).leftJoin(orders, eq(orders.id, supportTickets.orderId)).where(and(eq(supportTickets.userId, userId), cursorCondition(supportTickets.updatedAt, supportTickets.id, cursor)))
    .orderBy(...cursorOrder(supportTickets.updatedAt, supportTickets.id, cursor)).limit(PAGE_SIZE + 1);
  return cursorPage(rows, cursor);
}

export async function staffTickets(rawCursor?: string) {
  const cursor = decodeCursor(rawCursor);
  const rows = await db.select({ id: supportTickets.id, cursorAt: cursorTimestamp(supportTickets.updatedAt), subject: supportTickets.subject, status: supportTickets.status, updatedAt: supportTickets.updatedAt, username: users.username, orderNumber: orders.orderNumber })
    .from(supportTickets).innerJoin(users, eq(users.id, supportTickets.userId)).leftJoin(orders, eq(orders.id, supportTickets.orderId)).where(cursorCondition(supportTickets.updatedAt, supportTickets.id, cursor))
    .orderBy(...cursorOrder(supportTickets.updatedAt, supportTickets.id, cursor)).limit(PAGE_SIZE + 1);
  return cursorPage(rows, cursor);
}

export async function ticketDetail(ticketId: string, userId?: string) {
  const [ticket] = await db.select({ id: supportTickets.id, userId: supportTickets.userId, subject: supportTickets.subject, status: supportTickets.status, createdAt: supportTickets.createdAt, orderId: supportTickets.orderId, orderNumber: orders.orderNumber, username: users.username })
    .from(supportTickets).innerJoin(users, eq(users.id, supportTickets.userId)).leftJoin(orders, eq(orders.id, supportTickets.orderId))
    .where(and(eq(supportTickets.id, ticketId), userId ? eq(supportTickets.userId, userId) : undefined)).limit(1);
  if (!ticket) return null;
  const messages = await db.select({ id: supportMessages.id, authorRole: supportMessages.authorRole, body: supportMessages.body, createdAt: supportMessages.createdAt })
    .from(supportMessages).where(eq(supportMessages.ticketId, ticket.id)).orderBy(asc(supportMessages.createdAt), asc(supportMessages.id)).limit(200);
  return { ticket, messages };
}
