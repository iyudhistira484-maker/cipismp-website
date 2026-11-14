import { createHash } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { minecraftProfiles } from "./db/schema";
import { ids } from "./ids";
import { env } from "./env";
import { logger } from "./logger";

export type Edition = "JAVA" | "BEDROCK";

export interface ResolvedPlayer {
  uuid: string;
  name: string;
  edition: Edition;
  source: "mojang" | "offline" | "cache";
}

export class InvalidUsernameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUsernameError";
  }
}

const JAVA_NAME = /^[A-Za-z0-9_]{3,16}$/;
const BEDROCK_NAME = /^_[A-Za-z0-9_ ]{3,16}$/;

/** A leading underscore is ambiguous: Java usernames can begin with it too. */
export function normalizeUsername(raw: string, selectedEdition?: Edition): { name: string; edition: Edition } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new InvalidUsernameError("Username Minecraft wajib diisi.");
  if (selectedEdition !== undefined && selectedEdition !== "JAVA" && selectedEdition !== "BEDROCK") {
    throw new InvalidUsernameError("Pilih edisi Minecraft yang valid.");
  }
  if (!selectedEdition && name.startsWith("_")) {
    throw new InvalidUsernameError("Pilih edisi Java atau Bedrock untuk nama yang diawali _.");
  }
  const edition = selectedEdition ?? "JAVA";
  if (edition === "JAVA" && !JAVA_NAME.test(name)) {
    throw new InvalidUsernameError("Username Java 3–16 karakter, hanya huruf, angka, dan garis bawah.");
  }
  if (edition === "BEDROCK" && !BEDROCK_NAME.test(name)) {
    throw new InvalidUsernameError("Nama Bedrock harus menggunakan awalan _ dan 3–16 karakter setelahnya.");
  }
  return { name, edition };
}

function offlineUuid(seed: string): string {
  const hash = createHash("md5").update(seed, "utf8").digest();
  hash[6] = (hash[6]! & 0x0f) | 0x30; // versi 3
  hash[8] = (hash[8]! & 0x3f) | 0x80; // varian RFC 4122
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * UUID Bedrock (Floodgate): diturunkan dari XUID di produksi. Karena XUID tidak
 * tersedia lewat API publik, store memakai UUID yang dilaporkan plugin saat
 * verifikasi in-game; sebelum itu dipakai UUID deterministik sebagai placeholder.
 */
export function deterministicUuid(name: string, edition: Edition): string {
  return edition === "BEDROCK" ? offlineUuid(`FloodgatePlayer:${name}`) : offlineUuid(`OfflinePlayer:${name}`);
}

interface MojangProfile {
  id: string;
  name: string;
}

function dashes(uuid: string): string {
  const clean = uuid.replace(/-/g, "");
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

async function fetchMojang(name: string, timeoutMs = 4000): Promise<MojangProfile | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`, {
      signal: controller.signal,
      headers: { "User-Agent": "CipiSMP-Store/1.0 (+https://cipismp.my.id)" },
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) throw new Error(`Mojang API ${res.status}`);
    const data = (await res.json()) as { id?: string; name?: string };
    if (!data.id) return null;
    return { id: dashes(data.id), name: data.name ?? name };
  } finally {
    clearTimeout(timer);
  }
}

/** Resolusi nama → UUID. Mode `mock` dipakai di dev/test agar tidak butuh jaringan. */
export async function resolvePlayer(rawName: string, selectedEdition?: Edition): Promise<ResolvedPlayer> {
  const { name, edition } = normalizeUsername(rawName, selectedEdition);

  if (edition === "BEDROCK" || env.MINECRAFT_LOOKUP_MODE === "offline") {
    // In offline mode only a freshly authenticated v2 plugin identity is usable
    // for checkout. Older links and guessed UUIDs must be verified again.
    const profiles = await db.select().from(minecraftProfiles).where(and(
      eq(minecraftProfiles.edition, edition),
      eq(sql`lower(${minecraftProfiles.displayName})`, name.toLowerCase()),
      isNotNull(minecraftProfiles.verifiedAt),
      isNotNull(minecraftProfiles.userId),
      env.MINECRAFT_LOOKUP_MODE === "offline" ? eq(minecraftProfiles.identityVerifiedVersion, 2) : undefined,
    )).limit(2);
    if (profiles.length > 1) throw new InvalidUsernameError("Nama Minecraft memiliki beberapa profil. Hubungi bantuan.");
    if (profiles[0]) return { uuid: profiles[0].uuid, name: profiles[0].displayName, edition, source: "cache" };
  }

  if (env.MINECRAFT_LOOKUP_MODE === "mock" || env.MINECRAFT_LOOKUP_MODE === "offline" || edition === "BEDROCK") {
    return {
      uuid: deterministicUuid(name, edition),
      name: edition === "BEDROCK" ? name : name,
      edition,
      source: "offline",
    };
  }

  try {
    const profile = await fetchMojang(name);
    if (profile) return { uuid: profile.id, name: profile.name, edition, source: "mojang" };
    throw new InvalidUsernameError("Akun Minecraft dengan nama itu tidak ditemukan.");
  } catch (error) {
    if (error instanceof InvalidUsernameError) throw error;
    logger.warn("mojang_lookup_failed", { name, error: (error as Error).message });
    throw new InvalidUsernameError("Tidak bisa memverifikasi akun ke Mojang saat ini. Coba lagi sebentar lagi.");
  }
}

/** Simpan/perbarui profil & refresh nama bila berubah (ownership tetap di UUID). */
export async function upsertProfile(input: {
  uuid: string;
  name: string;
  edition: Edition;
}): Promise<void> {
  const now = new Date();
  await db.insert(minecraftProfiles).values({
    id: ids.minecraft(), uuid: input.uuid, displayName: input.name, edition: input.edition,
    userId: null, verifiedAt: null, lastSyncedAt: now,
  }).onConflictDoUpdate({
    target: minecraftProfiles.uuid,
    // Checkout may refresh a name, but must never claim or verify ownership.
    set: { displayName: input.name, edition: input.edition, lastSyncedAt: now, updatedAt: now },
  });
}

export async function findProfileByUuid(uuid: string) {
  return db.query.minecraftProfiles.findFirst({ where: eq(minecraftProfiles.uuid, uuid) });
}

export async function profilesForUser(userId: string) {
  return db.select().from(minecraftProfiles).where(eq(minecraftProfiles.userId, userId));
}

/** Profil terverifikasi yang boleh dipakai untuk pembelian. */
export async function verifiedProfilesForUser(userId: string) {
  return db
    .select()
    .from(minecraftProfiles)
    .where(and(eq(minecraftProfiles.userId, userId), isNotNull(minecraftProfiles.verifiedAt),
      env.MINECRAFT_LOOKUP_MODE === "offline" ? eq(minecraftProfiles.identityVerifiedVersion, 2) : undefined));
}

/** URL avatar (skin head). Sumber pihak ketiga — didokumentasikan di ASSETS.md. */
export function headUrl(uuidOrName: string, size = 96): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(uuidOrName)}/${size}`;
}

/** Pencarian profil tanpa melempar error (dipakai route lookup). */
export async function getProfileByUuidSafe(uuid: string) {
  try {
    return await findProfileByUuid(uuid);
  } catch {
    return null;
  }
}
