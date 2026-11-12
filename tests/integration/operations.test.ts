import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { jobs, orders, seasons } from "@/server/db/schema";
import { env } from "@/server/env";
import { enqueue, reclaimStaleJobs } from "@/server/queue";
import { GET as health } from "@/app/api/health/route";
import { POST as cron } from "@/app/api/cron/route";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix(), season = `ops-season-${suffix}`, order = `ops-order-${suffix}`;
const jobIds: string[] = [];

describe.skipIf(!databaseUrl())("operasional lokal", () => {
  beforeAll(async () => {
    await db.insert(seasons).values({ id: season, name: "Ops test", slug: season, status: "UPCOMING", startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 172800000) });
    await db.insert(orders).values({ id: order, orderNumber: order, publicToken: order, email: "ops@example.test", mcUuid: "test", mcName: "Test", seasonId: season, subtotalIdr: 10000, totalIdr: 10000, status: "PENDING", expiresAt: new Date(Date.now() - 1000) });
  });
  afterAll(async () => {
    if (jobIds.length) await db.delete(jobs).where(inArray(jobs.id, jobIds));
    await db.delete(orders).where(eq(orders.id, order));
    await db.delete(seasons).where(eq(seasons.id, season));
  });
  it("health menunjukkan database tersedia, cron menolak secret salah dan memproses job sah", async () => {
    expect((await health()).status).toBe(200);
    const id = await enqueue("order.expire", {}, { runAt: new Date("2000-01-01T00:00:00Z") }); jobIds.push(id);
    expect((await cron(new Request("http://test/api/cron", { method: "POST", headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect((await db.query.orders.findFirst({ where: eq(orders.id, order) }))?.status).toBe("PENDING");
    const response = await cron(new Request("http://test/api/cron", { method: "POST", headers: { authorization: `Bearer ${env.CRON_SECRET}` } }));
    expect(response.status).toBe(200);
    expect((await db.query.orders.findFirst({ where: eq(orders.id, order) }))?.status).toBe("EXPIRED");
    expect((await db.query.jobs.findFirst({ where: eq(jobs.id, id) }))?.status).toBe("DONE");
  });
  it("job yang ditinggalkan pekerja dikembalikan ke antrean", async () => {
    const id = await enqueue("order.expire", {}); jobIds.push(id);
    await db.update(jobs).set({ status: "RUNNING", lockedAt: new Date(Date.now() - 11 * 60000), lockedBy: "dead-test-worker" }).where(eq(jobs.id, id));
    await reclaimStaleJobs(10);
    expect(await db.query.jobs.findFirst({ where: eq(jobs.id, id) })).toMatchObject({ status: "PENDING", lockedBy: null, lockedAt: null });
  });
});
