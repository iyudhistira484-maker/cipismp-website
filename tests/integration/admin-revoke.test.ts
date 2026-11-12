import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, commandTemplates, deliveries, entitlements, jobs, minecraftProfiles, products, seasons, users } from "@/server/db/schema";
import { adminRevokeEntitlementAction } from "@/app/actions/admin";
import type { Permission, Role } from "@/server/rbac";
import { databaseUrl, uniqueSuffix } from "./helpers";

const authState = vi.hoisted(() => ({ actorId: "", role: "SUPPORT" }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "http://localhost:3000", "user-agent": "admin-revoke-integration-test" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/rate-limit", () => ({ enforceRateLimit: async () => undefined }));
vi.mock("@/server/auth/guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/guard")>();
  const rbac = await import("@/server/rbac");
  const getViewer = () => ({
    user: {
      id: authState.actorId,
      email: "support-revoke-test@example.test",
      username: "revoke-support",
      role: authState.role as Role,
    },
    sessionId: "session-revoke-test",
  });
  return {
    ...actual,
    requireStaff: async () => {
      if (!rbac.isStaff(authState.role as Role)) throw new rbac.ForbiddenError();
      return getViewer();
    },
    requirePermissionApi: async (permission: Permission) => {
      rbac.assertPermission(authState.role as Role, permission);
      return getViewer();
    },
  };
});

const enabled = databaseUrl() !== null;
const suffix = uniqueSuffix();
const actorId = `usr_revoke_actor_${suffix}`;
const customerId = `usr_revoke_customer_${suffix}`;
const seasonId = `sn_revoke_${suffix}`;
const productId = `prd_revoke_${suffix}`;
const noCommandProductId = `prd_revoke_manual_${suffix}`;
const profileId = `mcp_revoke_${suffix}`;
const entitlementId = `ent_revoke_${suffix}`;
const manualEntitlementId = `ent_revoke_manual_${suffix}`;
const templateId = `cmd_revoke_${suffix}`;
const playerUuid = `11111111-1111-4111-8111-${suffix.padEnd(12, "0")}`;
const manualPlayerUuid = `22222222-2222-4222-8222-${suffix.padEnd(12, "0")}`;

describe.skipIf(!enabled)("pencabutan entitlement admin", () => {
  beforeAll(async () => {
    authState.actorId = actorId;
    await db.insert(users).values([
      {
        id: actorId,
        email: `revoke-support-${suffix}@example.test`,
        username: `revokesupport${suffix}`,
        passwordHash: "test-only",
        role: "SUPPORT",
      },
      {
        id: customerId,
        email: `revoke-customer-${suffix}@example.test`,
        username: `revokecustomer${suffix}`,
        passwordHash: "test-only",
        role: "CUSTOMER",
      },
    ]);
    await db.insert(seasons).values({
      id: seasonId,
      name: `Revoke test ${suffix}`,
      slug: `revoke-test-${suffix}`,
      startAt: new Date(Date.now() - 86_400_000),
      endAt: new Date(Date.now() + 86_400_000),
    });
    await db.insert(products).values([
      {
        id: productId,
        slug: `revoke-kit-${suffix}`,
        type: "KIT",
        name: "Revoke Test Kit",
        tagline: "Test",
        description: "Product used for admin revoke integration test.",
        priceIdr: 1_000,
      },
      {
        id: noCommandProductId,
        slug: `revoke-manual-${suffix}`,
        type: "RANK",
        name: "Manual Revoke Test",
        tagline: "Test",
        description: "Product without a revoke template.",
        priceIdr: 1_000,
      },
    ]);
    await db.insert(minecraftProfiles).values({
      id: profileId,
      uuid: playerUuid,
      edition: "JAVA",
      displayName: `RevokePlayer${suffix.slice(0, 4)}`,
      userId: customerId,
    });
    await db.insert(commandTemplates).values({
      id: templateId,
      productId,
      kind: "REVOKE",
      template: "lp user {player} permission unset {rank}",
    });
    await db.insert(entitlements).values([
      {
        id: entitlementId,
        uuid: playerUuid,
        productId,
        seasonId,
        active: true,
        source: "COMP",
        reason: "original reason",
        playerName: `RevokePlayer${suffix.slice(0, 4)}`,
      },
      {
        id: manualEntitlementId,
        uuid: manualPlayerUuid,
        productId: noCommandProductId,
        seasonId,
        active: true,
        source: "COMP",
        playerName: `ManualPlayer${suffix.slice(0, 4)}`,
      },
    ]);
  });

  afterAll(async () => {
    const queuedDeliveries = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(inArray(deliveries.uuid, [playerUuid, manualPlayerUuid]));
    for (const delivery of queuedDeliveries) {
      await db.delete(jobs).where(eq(jobs.dedupeKey, `deliver:${delivery.id}`));
    }
    await db.delete(deliveries).where(inArray(deliveries.uuid, [playerUuid, manualPlayerUuid]));
    await db.delete(auditLogs).where(inArray(auditLogs.targetId, [entitlementId, manualEntitlementId]));
    await db.delete(entitlements).where(inArray(entitlements.id, [entitlementId, manualEntitlementId]));
    await db.delete(commandTemplates).where(eq(commandTemplates.id, templateId));
    await db.delete(minecraftProfiles).where(eq(minecraftProfiles.id, profileId));
    await db.delete(products).where(inArray(products.id, [productId, noCommandProductId]));
    await db.delete(seasons).where(eq(seasons.id, seasonId));
    await db.delete(users).where(inArray(users.id, [actorId, customerId]));
  });

  it("menolak role pelanggan sebelum mengubah entitlement", async () => {
    authState.role = "CUSTOMER";
    const formData = new FormData();
    formData.set("entitlementId", entitlementId);
    formData.set("reason", "Koreksi entitlement");

    const result = await adminRevokeEntitlementAction({}, formData);
    const [entitlement] = await db.select().from(entitlements).where(eq(entitlements.id, entitlementId));

    expect(result.error).toMatch(/akses/i);
    expect(entitlement?.active).toBe(true);
  });

  it("menonaktifkan entitlement, mengantrekan REVOKE, dan mencatat alasan/audit", async () => {
    authState.role = "SUPPORT";
    const formData = new FormData();
    formData.set("entitlementId", entitlementId);
    formData.set("reason", "Koreksi akses ganda");

    const result = await adminRevokeEntitlementAction({}, formData);
    const [entitlement] = await db.select().from(entitlements).where(eq(entitlements.id, entitlementId));
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.uuid, playerUuid));
    const [job] = delivery
      ? await db.select().from(jobs).where(eq(jobs.dedupeKey, `deliver:${delivery.id}`))
      : [];
    const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.targetId, entitlementId));

    expect(result.success).toMatch(/1 perintah REVOKE diantrekan/);
    expect(entitlement).toMatchObject({ active: false, reason: "Koreksi akses ganda" });
    expect(entitlement?.revokedAt).toBeInstanceOf(Date);
    expect(delivery).toMatchObject({ status: "QUEUED", orderId: null, uuid: playerUuid });
    expect(delivery?.commands).toEqual([`lp user RevokePlayer${suffix.slice(0, 4)} permission unset revoke-kit-${suffix}`]);
    expect(job).toMatchObject({ type: "delivery.process", payload: { deliveryId: delivery?.id } });
    expect(audit).toMatchObject({
      actorId,
      action: "entitlement.revoked",
      targetType: "entitlement",
      targetId: entitlementId,
      reason: "Koreksi akses ganda",
    });
  });

  it("menonaktifkan akses tanpa template dan memberi instruksi pencabutan manual", async () => {
    authState.role = "SUPPORT";
    const formData = new FormData();
    formData.set("entitlementId", manualEntitlementId);
    formData.set("reason", "Produk belum punya REVOKE");

    const result = await adminRevokeEntitlementAction({}, formData);
    const [entitlement] = await db.select().from(entitlements).where(eq(entitlements.id, manualEntitlementId));
    const queued = await db.select().from(deliveries).where(eq(deliveries.uuid, manualPlayerUuid));

    expect(result.success).toMatch(/cabut akses di server secara manual/i);
    expect(entitlement).toMatchObject({ active: false, reason: "Produk belum punya REVOKE" });
    expect(queued).toHaveLength(0);
  });
});
