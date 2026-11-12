import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { notifications, orders, seasons, supportTickets, users } from "@/server/db/schema";
import { closeSupportTicket, createSupportTicket, customerTickets, replySupportTicket, ticketDetail } from "@/server/support";
import { databaseUrl, uniqueSuffix } from "./helpers";
import { staffNotifications } from "@/server/notifications";

const suffix = uniqueSuffix();
const user = `support-u-${suffix}`, other = `support-other-${suffix}`, staff = `support-staff-${suffix}`, season = `support-season-${suffix}`, order = `support-order-${suffix}`;
let ticketId = "";

describe.skipIf(!databaseUrl())("pusat bantuan", () => {
  beforeAll(async () => {
    await db.insert(users).values([
      { id: user, email: `${user}@example.test`, username: `usr${suffix}`, passwordHash: "test" },
      { id: other, email: `${other}@example.test`, username: `other${suffix}`, passwordHash: "test" },
      { id: staff, email: `${staff}@example.test`, username: `staff${suffix}`, passwordHash: "test", role: "SUPPORT" },
    ]);
    await db.insert(seasons).values({ id: season, name: "Support test", slug: season, status: "UPCOMING", startAt: new Date(), endAt: new Date(Date.now() + 86400000) });
    await db.insert(orders).values({ id: order, orderNumber: order, publicToken: order, userId: user, email: `${user}@example.test`, mcUuid: "test", mcName: "TestPlayer", seasonId: season, subtotalIdr: 10000, totalIdr: 10000, expiresAt: new Date() });
  });
  afterAll(async () => {
    if (ticketId) await db.delete(notifications).where(eq(notifications.href, `/admin/bantuan/${ticketId}`));
    await db.delete(supportTickets).where(eq(supportTickets.userId, user));
    await db.delete(orders).where(eq(orders.id, order));
    await db.delete(seasons).where(eq(seasons.id, season));
    for (const id of [user, other, staff]) await db.delete(users).where(eq(users.id, id));
  });
  it("validasi input dan tidak mengizinkan penautan pesanan akun lain", async () => {
    await expect(createSupportTicket(other, { subject: "Masalah order", body: "Saya membutuhkan bantuan", orderId: order })).rejects.toThrow(/tidak ditemukan/i);
    await expect(createSupportTicket(user, { subject: "x", body: "Saya membutuhkan bantuan" })).rejects.toThrow(/Judul/);
    ticketId = await createSupportTicket(user, { subject: "Rank belum masuk", body: "Mohon bantu periksa rank saya.", orderId: order });
    expect((await customerTickets(user)).items).toMatchObject([{ id: ticketId, orderNumber: order }]);
    expect(await ticketDetail(ticketId, other)).toBeNull();
    await expect(replySupportTicket(ticketId, { id: other, staff: false }, "Saya bukan pemilik")).rejects.toThrow(/tidak ditemukan/i);
  });
  it("staf membalas dan pemilik menerima notifikasi; tiket ditutup mencegah balasan", async () => {
    await replySupportTicket(ticketId, { id: staff, staff: true }, "Kami akan memeriksa pesanan ini.");
    const details = await ticketDetail(ticketId, user);
    expect(details?.messages.map((message) => message.authorRole)).toEqual(["CUSTOMER", "STAFF"]);
    const notices = await db.select().from(notifications).where(eq(notifications.userId, user));
    expect(notices.some((notice) => notice.href === `/dashboard/bantuan/${ticketId}`)).toBe(true);
    expect((await staffNotifications("SUPPORT")).some((notice) => notice.href === `/admin/bantuan/${ticketId}`)).toBe(true);
    await closeSupportTicket(ticketId);
    const closedNotices = await db.select().from(notifications).where(eq(notifications.userId, user));
    expect(closedNotices.some((notice) => notice.title === "Permintaan bantuan ditutup")).toBe(true);
    await expect(replySupportTicket(ticketId, { id: user, staff: false }, "Masih ada pertanyaan")).rejects.toThrow(/ditutup/i);
  });
  it("notifikasi staf menyaring area yang tidak diizinkan", async () => {
    const id = `notice-season-${suffix}`;
    await db.insert(notifications).values({ id, kind: "SYSTEM", title: "Season private", body: "Test", href: "/admin/season" });
    try {
      expect((await staffNotifications("SUPPORT")).some((notice) => notice.id === id)).toBe(false);
      expect((await staffNotifications("ADMIN")).some((notice) => notice.id === id)).toBe(true);
      expect(await staffNotifications("CUSTOMER")).toEqual([]);
    } finally { await db.delete(notifications).where(eq(notifications.id, id)); }
  });
});
