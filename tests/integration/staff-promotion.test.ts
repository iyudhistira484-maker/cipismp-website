import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, users } from "@/server/db/schema";
import { adminPromoteCustomerAction, adminSetRoleAction } from "@/app/actions/admin";
import type { Permission, Role } from "@/server/rbac";
import { databaseUrl, uniqueSuffix } from "./helpers";

const auth = vi.hoisted(() => ({ id: "", role: "OWNER" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "http://localhost:3000" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/rate-limit", () => ({ enforceRateLimit: async () => undefined }));
vi.mock("@/server/auth/guard", async (original) => {
  const actual = await original<typeof import("@/server/auth/guard")>();
  const rbac = await import("@/server/rbac");
  const viewer = () => ({ user: { id: auth.id, username: "owner-test", email: "owner@example.test", role: auth.role as Role }, sessionId: "test" });
  return { ...actual, requireStaff: async () => { if (!rbac.isStaff(auth.role as Role)) throw new rbac.ForbiddenError(); return viewer(); },
    requirePermissionApi: async (permission: Permission) => { rbac.assertPermission(auth.role as Role, permission); return viewer(); } };
});
const suffix = uniqueSuffix();
const owner = `promotion-owner-${suffix}`, customer = `promotion-customer-${suffix}`, deleted = `promotion-deleted-${suffix}`;
function data(extra: Record<string, string> = {}) {
  const values: Record<string, string> = { userId: customer, role: "ADMIN", reason: "Identitas staf sudah dikonfirmasi", confirmed: "on", ...extra };
  const form = new FormData(); for (const [key, value] of Object.entries(values)) form.set(key, value); return form;
}

describe.skipIf(!databaseUrl())("promosi akun pelanggan menjadi staf", () => {
  beforeAll(async () => {
    auth.id = owner;
    await db.insert(users).values([
      { id: owner, username: `own${suffix}`, email: `${owner}@example.test`, passwordHash: "test", role: "OWNER" },
      { id: customer, username: `cus${suffix}`, email: `${customer}@example.test`, passwordHash: "test", role: "CUSTOMER" },
      { id: deleted, username: `del${suffix}`, email: `${deleted}@example.test`, passwordHash: "test", role: "CUSTOMER", deletedAt: new Date(), emailVerifiedAt: new Date(), totpEnabledAt: new Date() },
    ]);
  });
  afterAll(async () => {
    await db.delete(auditLogs).where(inArray(auditLogs.targetId, [customer, deleted]));
    await db.delete(users).where(inArray(users.id, [owner, customer, deleted]));
  });
  it("menolak non-owner, role owner, akun terhapus, identitas tanpa verifikasi dan bypass action lama", async () => {
    auth.role = "ADMIN";
    expect((await adminPromoteCustomerAction({}, data())).error).toBeTruthy();
    auth.role = "OWNER";
    expect((await adminPromoteCustomerAction({}, data({ role: "OWNER" }))).error).toBeTruthy();
    expect((await adminPromoteCustomerAction({}, data({ userId: deleted }))).error).toBeTruthy();
    expect((await adminPromoteCustomerAction({}, data())).error).toMatch(/email dan mengaktifkan 2FA/);
    expect((await adminSetRoleAction({}, data())).error).toMatch(/promosi pelanggan/);
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, customer));
    expect((await adminPromoteCustomerAction({}, data())).error).toMatch(/2FA/);
    await db.update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, customer));
    expect((await adminPromoteCustomerAction({}, data({ confirmed: "" }))).error).toMatch(/Konfirmasi/);
    expect((await adminPromoteCustomerAction({}, data({ reason: "pendek" }))).error).toMatch(/Alasan/);
  });
  it("mengembalikan perubahan bila audit gagal, lalu mempromosikan akun yang sama", async () => {
    auth.id = `missing-${suffix}`;
    expect((await adminPromoteCustomerAction({}, data())).error).toBeTruthy();
    expect((await db.query.users.findFirst({ where: eq(users.id, customer) }))?.role).toBe("CUSTOMER");
    auth.id = owner;
    expect((await adminPromoteCustomerAction({}, data())).success).toBeTruthy();
    expect((await db.query.users.findFirst({ where: eq(users.id, customer) }))?.role).toBe("ADMIN");
    const audits = await db.select().from(auditLogs).where(and(eq(auditLogs.targetId, customer), eq(auditLogs.action, "staff.role-changed")));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorId: owner, before: { role: "CUSTOMER" }, after: { role: "ADMIN" }, reason: "Identitas staf sudah dikonfirmasi" });
    expect((await adminPromoteCustomerAction({}, data())).error).toBeTruthy();
    expect((await adminSetRoleAction({}, data({ role: "CUSTOMER" }))).success).toBeTruthy();
    expect((await db.query.users.findFirst({ where: eq(users.id, customer) }))?.role).toBe("CUSTOMER");
  });
});
