import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, minecraftProfiles, staffMinecraftAccounts, users } from "@/server/db/schema";
import { adminRegisterStaffMinecraftAction, adminRemoveStaffMinecraftAction } from "@/app/actions/admin";
import { hasKnownStaffRankRestriction, knownStaffDeliveryQuery } from "@/server/staff-rank";
import type { Permission, Role } from "@/server/rbac";
import { databaseUrl, uniqueSuffix } from "./helpers";

const auth = vi.hoisted(() => ({ id: "", role: "OWNER" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "http://localhost:3000" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/rate-limit", () => ({ enforceRateLimit: async () => undefined }));
vi.mock("@/server/auth/guard", async (original) => {
  const actual = await original<typeof import("@/server/auth/guard")>();
  const rbac = await import("@/server/rbac");
  const viewer = () => ({ user: { id: auth.id, username: "testowner", email: "owner@example.test", role: auth.role as Role }, sessionId: "test" });
  return { ...actual, requireStaff: async () => { if (!rbac.isStaff(auth.role as Role)) throw new rbac.ForbiddenError(); return viewer(); },
    requirePermissionApi: async (permission: Permission) => { rbac.assertPermission(auth.role as Role, permission); return viewer(); } };
});

const suffix = uniqueSuffix();
const owner = `staff-reg-owner-${suffix}`, staff = `staff-reg-user-${suffix}`, customer = `staff-reg-customer-${suffix}`;
const uuid = `aaaaaaaa-aaaa-4aaa-8aaa-${suffix.padEnd(12, "0")}`;
const other = `bbbbbbbb-bbbb-4bbb-8bbb-${suffix.padEnd(12, "0")}`;
const profileId = `staff-reg-profile-${suffix}`;
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }

describe.skipIf(!databaseUrl())("daftar UUID Minecraft staf", () => {
  beforeAll(async () => {
    auth.id = owner;
    await db.insert(users).values([
      { id: owner, email: `${owner}@example.test`, username: `own${suffix}`, passwordHash: "test", role: "OWNER" },
      { id: staff, email: `${staff}@example.test`, username: `stf${suffix}`, passwordHash: "test", role: "SUPPORT" },
      { id: customer, email: `${customer}@example.test`, username: `cus${suffix}`, passwordHash: "test", role: "CUSTOMER" },
    ]);
  });
  afterAll(async () => {
    await db.delete(minecraftProfiles).where(eq(minecraftProfiles.id, profileId));
    await db.delete(staffMinecraftAccounts).where(inArray(staffMinecraftAccounts.uuid, [uuid, other]));
    await db.delete(auditLogs).where(inArray(auditLogs.actorId, [owner, staff]));
    await db.delete(users).where(inArray(users.id, [owner, staff, customer]));
  });
  it("hanya owner dapat mendaftarkan UUID, dengan audit dan validasi", async () => {
    const data = form({ uuid: uuid.toUpperCase(), staffUserId: staff, label: "akun alternatif", reason: "Dikonfirmasi oleh owner" });
    auth.role = "SUPPORT";
    expect((await adminRegisterStaffMinecraftAction({}, data)).error).toBeTruthy();
    expect(await db.query.staffMinecraftAccounts.findFirst({ where: eq(staffMinecraftAccounts.uuid, uuid) })).toBeUndefined();
    auth.role = "OWNER";
    expect((await adminRegisterStaffMinecraftAction({}, form({ uuid: other, staffUserId: customer, label: "X", reason: "Dikonfirmasi oleh owner" }))).error).toMatch(/staf/);
    expect((await adminRegisterStaffMinecraftAction({}, form({ uuid: "bad", staffUserId: staff, label: "X", reason: "Dikonfirmasi oleh owner" }))).error).toMatch(/UUID/);
    expect((await adminRegisterStaffMinecraftAction({}, data)).success).toBeTruthy();
    expect((await adminRegisterStaffMinecraftAction({}, data)).error).toMatch(/sudah terdaftar/);
    expect(await db.select().from(auditLogs).where(and(eq(auditLogs.targetId, uuid), eq(auditLogs.action, "staff.minecraft.registered")))).toHaveLength(1);
  });
  it("menahan penerima maupun pembeli yang memiliki profil terverifikasi; melepas saat role menjadi pelanggan", async () => {
    expect(await hasKnownStaffRankRestriction(null, [uuid.toUpperCase()])).toBe(true);
    await db.insert(minecraftProfiles).values({ id: profileId, uuid, displayName: `Alt${suffix.slice(0, 4)}`, edition: "JAVA", userId: customer, verifiedAt: new Date() });
    expect(await hasKnownStaffRankRestriction(customer, [other])).toBe(true);
    expect((await db.execute(knownStaffDeliveryQuery(uuid, null))).rows[0]?.restricted).toBe(true);
    await db.update(users).set({ role: "CUSTOMER" }).where(eq(users.id, staff));
    try {
      expect(await hasKnownStaffRankRestriction(null, [uuid])).toBe(false);
      expect(await hasKnownStaffRankRestriction(customer, [other])).toBe(false);
      expect((await db.execute(knownStaffDeliveryQuery(uuid, null))).rows[0]?.restricted).toBe(false);
    } finally { await db.update(users).set({ role: "SUPPORT" }).where(eq(users.id, staff)); }
  });
  it("penghapusan perlu owner, alasan, konfirmasi dan audit", async () => {
    const noConfirm = form({ uuid, reason: "Data akun sudah dikonfirmasi" });
    expect((await adminRemoveStaffMinecraftAction({}, noConfirm)).error).toMatch(/konfirmasi/i);
    const data = form({ uuid, reason: "Data akun sudah dikonfirmasi", confirmed: "on" });
    auth.role = "ADMIN";
    expect((await adminRemoveStaffMinecraftAction({}, data)).error).toBeTruthy();
    auth.role = "OWNER";
    expect((await adminRemoveStaffMinecraftAction({}, data)).success).toBeTruthy();
    expect(await db.query.staffMinecraftAccounts.findFirst({ where: eq(staffMinecraftAccounts.uuid, uuid) })).toBeUndefined();
    expect(await db.select().from(auditLogs).where(and(eq(auditLogs.targetId, uuid), eq(auditLogs.action, "staff.minecraft.removed")))).toHaveLength(1);
  });
});
