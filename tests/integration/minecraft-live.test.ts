import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { minecraftLiveSnapshots, minecraftProfiles, pluginNonces, users } from "@/server/db/schema";
import { livePayloadSchema, liveSnapshotsForUser, saveLiveSnapshots } from "@/server/minecraft-live";
import { computePluginSignature } from "@/server/delivery/plugin-auth";
import { POST } from "@/app/api/plugin/player-status/route";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix(), owner = `live-a-${suffix}`, other = `live-b-${suffix}`;
const uuid = randomUUID(), bedrock = "00000000-0000-0000-0009-01f0cdeadbee", unknown = randomUUID();
const profile = `live-profile-${suffix}`, unverifiedProfile = `live-unverified-${suffix}`;
const nonce = `live-nonce-${suffix}`;
const time = Date.now();
const data = { observedAt: time, players: [{ uuid, primaryGroup: "vip", kits: [{ name: "cipi++", cooldown: "4 jam 55 menit" }] }, { uuid: bedrock, primaryGroup: null, kits: [] }, { uuid: unknown, primaryGroup: "legend", kits: [] }] };

describe.skipIf(!databaseUrl())("snapshot status Minecraft", () => {
  beforeAll(async () => {
    await db.insert(users).values([owner, other].map((id, index) => ({ id, email: `${id}@example.test`, username: `live${index}${suffix}`, passwordHash: "test" })));
    await db.insert(minecraftProfiles).values([
      { id: profile, uuid, edition: "JAVA", displayName: "LivePlayer", userId: owner, verifiedAt: new Date(time - 10000) },
      { id: unverifiedProfile, uuid: bedrock, edition: "BEDROCK", displayName: "_Bedrock", userId: owner },
    ]);
  });
  afterAll(async () => {
    await db.delete(pluginNonces).where(eq(pluginNonces.nonce, nonce));
    await db.delete(minecraftProfiles).where(inArray(minecraftProfiles.id, [profile, unverifiedProfile]));
    await db.delete(users).where(inArray(users.id, [owner, other]));
  });
  it("memeriksa HMAC, nonce, dan hanya menyimpan profil terverifikasi", async () => {
    const body = JSON.stringify(data), timestamp = String(Math.floor(Date.now() / 1000));
    const signature = computePluginSignature({ secret: process.env.PLUGIN_SHARED_SECRET!, timestamp, nonce, body });
    const request = (sig: string) => new Request("https://example.test/api/plugin/player-status", { method: "POST", headers: { "x-cipi-timestamp": timestamp, "x-cipi-nonce": nonce, "x-cipi-signature": sig }, body });
    expect((await POST(request("bad-signature"))).status).toBe(401);
    expect((await POST(request(signature))).status).toBe(200);
    expect((await POST(request(signature))).status).toBe(409);
    const rows = await db.select().from(minecraftLiveSnapshots).where(inArray(minecraftLiveSnapshots.profileId, [profile, unverifiedProfile]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ profileId: profile, primaryGroup: "vip", kits: [{ name: "cipi++", cooldown: "4 jam 55 menit" }] });
    expect(await liveSnapshotsForUser(other, new Date(time + 1000))).toEqual([]);
    expect(await liveSnapshotsForUser(owner, new Date(time + 1000))).toMatchObject([{ profileId: profile }]);
  });
  it("snapshot kedaluwarsa tidak ditampilkan dan paket lama tidak menimpa data baru", async () => {
    expect(await liveSnapshotsForUser(owner, new Date(time + 91_000))).toEqual([]);
    await saveLiveSnapshots({ observedAt: time - 5000, players: [{ uuid, primaryGroup: "default", kits: [] }] }, new Date(time));
    expect((await db.select().from(minecraftLiveSnapshots).where(eq(minecraftLiveSnapshots.profileId, profile)))[0]?.primaryGroup).toBe("vip");
    await expect(saveLiveSnapshots({ ...data, observedAt: time - 100_000 }, new Date(time))).rejects.toThrow(/Waktu/);
  });
  it("penautan ulang tidak mengungkap pengamatan sebelum verifikasi baru", async () => {
    await db.update(minecraftProfiles).set({ userId: other, verifiedAt: new Date(time + 2000) }).where(eq(minecraftProfiles.id, profile));
    expect(await liveSnapshotsForUser(owner, new Date(time + 3000))).toEqual([]);
    expect(await liveSnapshotsForUser(other, new Date(time + 3000))).toEqual([]);
    await saveLiveSnapshots({ observedAt: time + 4000, players: [{ uuid, primaryGroup: null, kits: [{ name: "cipiprime", cooldown: null }] }] }, new Date(time + 4000));
    expect(await liveSnapshotsForUser(other, new Date(time + 5000))).toMatchObject([{ profileId: profile, primaryGroup: null }]);
  });
  it("menolak data berlebih, kontrol, dan UUID atau kit duplikat", () => {
    expect(livePayloadSchema.safeParse({ ...data, players: Array(51).fill(data.players[0]) }).success).toBe(false);
    expect(livePayloadSchema.safeParse({ ...data, players: [data.players[0], data.players[0]] }).success).toBe(false);
    expect(livePayloadSchema.safeParse({ observedAt: time, players: [{ uuid, primaryGroup: "bad\ntext", kits: [] }] }).success).toBe(false);
    expect(livePayloadSchema.safeParse({ observedAt: time, players: [{ uuid, primaryGroup: null, kits: [{ name: "kit", cooldown: null }, { name: "KIT", cooldown: null }] }] }).success).toBe(false);
    expect(livePayloadSchema.safeParse({ observedAt: time, players: [{ uuid: bedrock, primaryGroup: null, kits: [] }] }).success).toBe(true);
  });
});
