import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { authTokens, minecraftProfiles, users } from "@/server/db/schema";
import { sha256 } from "@/server/crypto";
import { consumeMinecraftVerification } from "@/server/auth/minecraft-verification";
import { resolvePlayer, upsertProfile } from "@/server/minecraft";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix().replace(/-/g, "");
const first = `mc-user-a-${suffix}`;
const second = `mc-user-b-${suffix}`;
const javaUuid = randomUUID();
const bedrockUuid = randomUUID();
const name = `.Bed${suffix.slice(0, 6)}`;
const ids = [first, second];
async function token(id: string, userId: string, code: string, payload: Record<string, string>) {
  await db.insert(authTokens).values({ id, type: "MC_VERIFY", userId, tokenHash: sha256(code), payload, expiresAt: new Date(Date.now() + 60_000) });
}

describe.skipIf(!databaseUrl())("verifikasi Minecraft in-game", () => {
  beforeAll(async () => {
    await db.insert(users).values(ids.map((id, i) => ({ id, email: `${id}@example.test`, username: `mctest${i}${suffix}`, passwordHash: "test" })));
  });
  afterAll(async () => {
    await db.delete(authTokens).where(inArray(authTokens.userId, ids));
    await db.delete(minecraftProfiles).where(inArray(minecraftProfiles.uuid, [javaUuid, bedrockUuid]));
    await db.delete(users).where(inArray(users.id, ids));
  });

  it("mengikat UUID Java hanya sekali meski permintaan paralel dan tidak membiarkan checkout mengubah pemilik", async () => {
    const code = "ABC234";
    await token(`mca-${suffix}`, first, code, { uuid: javaUuid, playerName: "JavaTest", edition: "JAVA" });
    const input = { code, uuid: javaUuid, player: "JavaTest" };
    const results = await Promise.all([consumeMinecraftVerification(input), consumeMinecraftVerification(input)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    await upsertProfile({ uuid: javaUuid, name: "JavaTest", edition: "JAVA" });
    const profile = await db.query.minecraftProfiles.findFirst({ where: eq(minecraftProfiles.uuid, javaUuid) });
    expect(profile?.userId).toBe(first);
    expect(profile?.verifiedAt).not.toBeNull();
  });

  it("menolak pengambilalihan profil yang sudah diverifikasi", async () => {
    await token(`mcb-${suffix}`, second, "DEF345", { uuid: javaUuid, playerName: "JavaTest", edition: "JAVA" });
    const result = await consumeMinecraftVerification({ code: "DEF345", uuid: javaUuid, player: "JavaTest" });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect((await db.query.minecraftProfiles.findFirst({ where: eq(minecraftProfiles.uuid, javaUuid) }))?.userId).toBe(first);
  });

  it("memeriksa nama Bedrock dan memakai UUID asli plugin setelah verifikasi", async () => {
    await token(`mcc-${suffix}`, first, "GHJ456", { uuid: randomUUID(), playerName: name, edition: "BEDROCK" });
    expect(await consumeMinecraftVerification({ code: "GHJ456", uuid: bedrockUuid, player: ".wrongname" })).toMatchObject({ ok: false, status: 409 });
    expect(await consumeMinecraftVerification({ code: "GHJ456", uuid: bedrockUuid, player: name })).toMatchObject({ ok: true, uuid: bedrockUuid });
    expect(await resolvePlayer(name)).toMatchObject({ uuid: bedrockUuid, edition: "BEDROCK", source: "cache" });
  });
});
