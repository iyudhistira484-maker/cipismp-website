import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { authTokens, commandTemplates, deliveries, minecraftProfiles, orders, products, seasons, servers, staffMinecraftAccounts, users } from "@/server/db/schema";
import { sha256 } from "@/server/crypto";
import { consumeMinecraftVerification } from "@/server/auth/minecraft-verification";
import { deterministicUuid, resolvePlayer } from "@/server/minecraft";
import { createOrder } from "@/server/orders";
import { pollPluginDeliveries } from "@/server/delivery/polling";
import { processDelivery } from "@/server/delivery";
import { databaseUrl, uniqueSuffix } from "./helpers";

vi.mock("@/server/env", async (original) => {
  const actual = await original<typeof import("@/server/env")>();
  return { ...actual, env: { ...actual.env, MINECRAFT_LOOKUP_MODE: "offline" } };
});
const suffix = uniqueSuffix();
const owner = `offline-user-${suffix}`, staff = `offline-staff-${suffix}`;
const server = `offline-server-${suffix}`, season = `offline-season-${suffix}`, product = `offline-product-${suffix}`;
const javaName = `Java${suffix.slice(0, 7)}`, bedrockName = `_Bed${suffix.slice(0, 6)}`;
const javaUuid = randomUUID(), bedrockUuid = "00000000-0000-0000-0009-01fd62950c17";
const legacyUuid = randomUUID(), oldBedrockUuid = randomUUID(), oldChangedUuid = randomUUID(), newChangedUuid = randomUUID(), collisionJavaUuid = randomUUID(), collisionBedrockUuid = randomUUID(), delivery = `offline-delivery-${suffix}`;
let previousServers: string[] = [];
const input = { mcName: javaName, email: `offline-${suffix}@example.test`, provider: "FAKE" as const, ip: "127.0.0.1", userAgent: "test", noRefundAccepted: true, legalVersions: { tos: "v1", privacy: "v1", sales: "v1" }, items: [{ productId: product }] };
async function token(id: string, code: string, name: string, edition: "JAVA" | "BEDROCK", mode = "offline", userId = owner) {
  await db.insert(authTokens).values({ id, type: "MC_VERIFY", userId, tokenHash: sha256(code), payload: { uuid: deterministicUuid(name, edition), playerName: name, edition, identityMode: mode }, expiresAt: new Date(Date.now() + 60_000) });
}

describe.skipIf(!databaseUrl())("identitas server offline terautentikasi", () => {
  beforeAll(async () => {
    await db.insert(users).values([
      { id: owner, username: `off${suffix}`, email: `${owner}@example.test`, passwordHash: "test", role: "CUSTOMER" },
      { id: staff, username: `stf${suffix}`, email: `${staff}@example.test`, passwordHash: "test", role: "SUPPORT" },
    ]);
    previousServers = (await db.select({ id: servers.id }).from(servers).where(eq(servers.isDefault, true))).map(x => x.id);
    await db.update(servers).set({ isDefault: false }).where(eq(servers.isDefault, true));
    await db.insert(servers).values({ id: server, name: "offline test", isDefault: true, javaHost: "example.test", bedrockHost: "example.test", deliveryMode: "PLUGIN" });
    await db.insert(seasons).values({ id: season, name: "Offline test", slug: `offline-${suffix}`, startAt: new Date(Date.now()-86400000), endAt: new Date(Date.now()+30*86400000), status: "ACTIVE", freezeDays: 3 });
    await db.insert(products).values({ id: product, name: "Test offline", slug: `offline-${suffix}`, type: "RANK", tier: 1, tagline: "Test", description: "Test", priceIdr: 25000, status: "PUBLISHED" });
    await db.insert(commandTemplates).values([
      { id: `off-grant-${suffix}`, productId: product, kind: "GRANT", template: "lp user {uuid} parent add vip" },
      { id: `off-revoke-${suffix}`, productId: product, kind: "REVOKE", template: "lp user {uuid} parent remove vip" },
    ]);
  });
  afterAll(async () => {
    await db.delete(deliveries).where(eq(deliveries.id, delivery));
    await db.delete(orders).where(eq(orders.email, input.email));
    await db.delete(staffMinecraftAccounts).where(eq(staffMinecraftAccounts.staffUserId, staff));
    await db.delete(authTokens).where(inArray(authTokens.userId, [owner, staff]));
    await db.delete(minecraftProfiles).where(inArray(minecraftProfiles.uuid, [javaUuid, bedrockUuid, legacyUuid, oldBedrockUuid, oldChangedUuid, newChangedUuid, collisionJavaUuid, collisionBedrockUuid]));
    await db.delete(commandTemplates).where(eq(commandTemplates.productId, product));
    await db.delete(products).where(eq(products.id, product));
    await db.delete(seasons).where(eq(seasons.id, season));
    await db.delete(servers).where(eq(servers.id, server));
    if (previousServers.length) await db.update(servers).set({ isDefault: true }).where(inArray(servers.id, previousServers));
    await db.delete(users).where(inArray(users.id, [owner, staff]));
  });
  it("menahan polling versi lama atau autentikasi tidak siap dan checkout tanpa plugin siap", async () => {
    await db.insert(deliveries).values({ id: delivery, uuid: javaUuid, playerName: javaName, productId: product, method: "PLUGIN", status: "QUEUED", nextAttemptAt: new Date(Date.now()-1000), commands: [`lp user ${javaUuid} parent add vip`] });
    expect(await pollPluginDeliveries({ version: "old", limit: 10 })).toEqual({ enabled: false, deliveries: [] });
    expect(await pollPluginDeliveries({ version: "new", identityProtocol: 2, authReady: false, limit: 10 })).toEqual({ enabled: false, deliveries: [] });
    expect((await db.query.deliveries.findFirst({ where: eq(deliveries.id, delivery) }))?.status).toBe("QUEUED");
    await db.update(servers).set({ deliveryMode: "RCON" }).where(eq(servers.id, server));
    expect(await processDelivery(delivery)).toMatchObject({ ok: false, error: expect.stringContaining("RCON tidak diizinkan") });
    await db.update(servers).set({ deliveryMode: "PLUGIN" }).where(eq(servers.id, server));
    await expect(createOrder(input)).rejects.toThrow(/sementara tidak siap/);
    const ready = await pollPluginDeliveries({ version: "new", identityProtocol: 2, authReady: true, limit: 10 });
    expect(ready.enabled).toBe(true);
    expect(ready.deliveries).toHaveLength(0); // legacy / unknown UUIDs cannot be leased
    expect((await db.query.deliveries.findFirst({ where: eq(deliveries.id, delivery) }))?.lastError).toMatch(/diverifikasi ulang/);
    await db.delete(deliveries).where(eq(deliveries.id, delivery));
    await expect(createOrder(input)).rejects.toThrow(/diverifikasi in-game/);
  });
  it("mengikat nama Java dan UUID nyata hanya dari protokol baru dengan edisi cocok", async () => {
    const code = "ABC234";
    await token(`off-java-${suffix}`, code, javaName, "JAVA");
    expect(await consumeMinecraftVerification({ code, uuid: javaUuid, player: javaName })).toMatchObject({ ok: false, status: 409 });
    expect(await consumeMinecraftVerification({ code, uuid: javaUuid, player: javaName, edition: "BEDROCK", identityVersion: 2 })).toMatchObject({ ok: false, status: 409 });
    expect(await consumeMinecraftVerification({ code, uuid: javaUuid, player: "WrongName", edition: "JAVA", identityVersion: 2 })).toMatchObject({ ok: false, status: 409 });
    expect(await consumeMinecraftVerification({ code, uuid: javaUuid, player: javaName, edition: "JAVA", identityVersion: 2 })).toMatchObject({ ok: true, uuid: javaUuid });
    expect(await resolvePlayer(javaName.toLowerCase())).toMatchObject({ uuid: javaUuid, name: javaName, source: "cache" });
    expect(javaUuid).not.toBe(deterministicUuid(javaName, "JAVA"));
    expect((await db.query.minecraftProfiles.findFirst({ where: eq(minecraftProfiles.uuid, javaUuid) }))?.identityVerifiedVersion).toBe(2);
    await db.insert(deliveries).values({ id: delivery, uuid: javaUuid, playerName: javaName, productId: product, method: "PLUGIN", status: "QUEUED", nextAttemptAt: new Date(Date.now()-1000), commands: [`lp user ${javaUuid} parent add vip`] });
    const leased = await pollPluginDeliveries({ version: "new", identityProtocol: 2, authReady: true, limit: 10 });
    expect(leased.deliveries.map(d => d.deliveryId)).toContain(delivery);
    await db.delete(deliveries).where(eq(deliveries.id, delivery));
  });
  it("tidak memakai profil lama sebagai identitas server dan menolak konflik nama", async () => {
    const legacyName = `Old${suffix.slice(0, 7)}`;
    await db.insert(minecraftProfiles).values({ id: `legacy-${suffix}`, uuid: legacyUuid, edition: "JAVA", displayName: legacyName, userId: owner, verifiedAt: new Date() });
    expect((await resolvePlayer(legacyName)).source).toBe("offline");
    await token(`legacy-token-${suffix}`, "BCD345", legacyName, "JAVA");
    expect(await consumeMinecraftVerification({ code: "BCD345", uuid: randomUUID(), player: legacyName, edition: "JAVA", identityVersion: 2 })).toMatchObject({ ok: false, status: 409 });
    expect(await consumeMinecraftVerification({ code: "BCD345", uuid: legacyUuid, player: legacyName, edition: "JAVA", identityVersion: 2 })).toMatchObject({ ok: true });
    expect((await resolvePlayer(legacyName)).source).toBe("cache");
  });
  it("menggunakan UUID Floodgate yang ditandatangani dan melarang pembelian/hadiah untuk staf yang terdaftar", async () => {
    await token(`off-bed-${suffix}`, "CDE456", bedrockName, "BEDROCK");
    expect(await consumeMinecraftVerification({ code: "CDE456", uuid: bedrockUuid, player: bedrockName, edition: "BEDROCK", identityVersion: 2 })).toMatchObject({ ok: true });
    expect(await resolvePlayer(bedrockName.toLowerCase(), "BEDROCK")).toMatchObject({ uuid: bedrockUuid, name: bedrockName, source: "cache" });
    const order = await createOrder(input);
    expect(order.order.mcUuid).toBe(javaUuid);
    await expect(createOrder({ ...input, items: [{ productId: product, targetName: "_NotVerified", targetEdition: "BEDROCK" }] })).rejects.toThrow(/memverifikasi/);
    await db.insert(staffMinecraftAccounts).values({ uuid: bedrockUuid, staffUserId: staff, label: "alternatif" });
    await expect(createOrder({ ...input, items: [{ productId: product, targetName: bedrockName, targetEdition: "BEDROCK" }] })).rejects.toThrow(/Rank tidak tersedia untuk staf/);
    await db.delete(staffMinecraftAccounts).where(eq(staffMinecraftAccounts.uuid, bedrockUuid));
  });
  it("menjaga edisi dan UUID untuk nama ambigu serta profil prefiks lama", async () => {
    const name = `_Same${suffix.slice(0, 5)}`;
    await token(`same-java-${suffix}`, "EFG567", name, "JAVA");
    expect(await consumeMinecraftVerification({ code: "EFG567", uuid: collisionJavaUuid, player: name, edition: "BEDROCK", identityVersion: 2 })).toMatchObject({ ok: false, status: 409 });
    expect(await consumeMinecraftVerification({ code: "EFG567", uuid: collisionJavaUuid, player: name, edition: "JAVA", identityVersion: 2 })).toMatchObject({ ok: true });
    await token(`same-bed-${suffix}`, "FGH678", name, "BEDROCK");
    expect(await consumeMinecraftVerification({ code: "FGH678", uuid: collisionBedrockUuid, player: name, edition: "BEDROCK", identityVersion: 2 })).toMatchObject({ ok: true });
    expect(await resolvePlayer(name, "JAVA")).toMatchObject({ uuid: collisionJavaUuid, edition: "JAVA" });
    expect(await resolvePlayer(name, "BEDROCK")).toMatchObject({ uuid: collisionBedrockUuid, edition: "BEDROCK" });
    await expect(resolvePlayer(name)).rejects.toThrow(/Pilih edisi/);
    await expect(createOrder({ ...input, items: [{ productId: product, targetName: name, targetUuid: collisionJavaUuid, targetEdition: "BEDROCK" }] })).rejects.toThrow(/Identitas penerima berubah/);

    const oldName = `.Old${suffix.slice(0, 5)}`;
    const newName = `_Old${suffix.slice(0, 5)}`;
    await db.insert(minecraftProfiles).values({ id: `old-bed-${suffix}`, uuid: oldBedrockUuid, edition: "BEDROCK", displayName: oldName, userId: owner, verifiedAt: new Date(), identityVerifiedVersion: 2 });
    await token(`old-code-${suffix}`, "GHJ789", oldName, "BEDROCK");
    expect(await consumeMinecraftVerification({ code: "GHJ789", uuid: oldBedrockUuid, player: oldName, edition: "BEDROCK", identityVersion: 2 })).toMatchObject({ ok: false, status: 409 });
    await expect(resolvePlayer(oldName, "BEDROCK")).rejects.toThrow();
    await token(`new-code-${suffix}`, "HJK892", newName, "BEDROCK", "offline", staff);
    expect(await consumeMinecraftVerification({ code: "HJK892", uuid: oldBedrockUuid, player: newName, edition: "BEDROCK", identityVersion: 2 })).toMatchObject({ ok: false, status: 409 });
    expect((await db.query.minecraftProfiles.findFirst({ where: eq(minecraftProfiles.uuid, oldBedrockUuid) }))).toMatchObject({ userId: owner, displayName: oldName });
    await token(`new-owner-${suffix}`, "JKM923", newName, "BEDROCK");
    expect(await consumeMinecraftVerification({ code: "JKM923", uuid: oldBedrockUuid, player: newName, edition: "BEDROCK", identityVersion: 2 })).toMatchObject({ ok: true });
    expect(await resolvePlayer(newName, "BEDROCK")).toMatchObject({ uuid: oldBedrockUuid, name: newName });
  });

  it("tidak memindahkan data jika UUID Floodgate berubah", async () => {
    const oldName = `.Changed${suffix.slice(0, 4)}`;
    const newName = `_Changed${suffix.slice(0, 4)}`;
    await db.insert(minecraftProfiles).values({ id: `changed-old-${suffix}`, uuid: oldChangedUuid, edition: "BEDROCK", displayName: oldName, userId: owner, verifiedAt: new Date(), identityVerifiedVersion: 2 });
    await token(`changed-new-${suffix}`, "KNM234", newName, "BEDROCK");
    expect(await consumeMinecraftVerification({ code: "KNM234", uuid: newChangedUuid, player: newName, edition: "BEDROCK", identityVersion: 2 })).toMatchObject({ ok: true });
    expect(await db.query.minecraftProfiles.findFirst({ where: eq(minecraftProfiles.uuid, oldChangedUuid) })).toMatchObject({ userId: owner, displayName: oldName });
    expect(await resolvePlayer(newName, "BEDROCK")).toMatchObject({ uuid: newChangedUuid });
  });

});
