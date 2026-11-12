import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db";
import {
  deliveries,
  entitlements,
  orders,
  products,
  seasons,
  users,
  type Season,
} from "../db/schema";
import { ids } from "../ids";
import { logger } from "../logger";
import { enqueue } from "../queue";
import { buildRevokeCommands } from "../delivery/commands";
import { alertStaff } from "../notifications";
import { writeAudit, type AuditActor } from "../audit";

export interface TransitionPreview {
  season: Season;
  nextSeason: Season | null;
  activeEntitlements: number;
  affectedPlayers: number;
  players: Array<{ uuid: string; playerName: string | null; products: string[] }>;
  canTransition: boolean;
  reason: string | null;
}

/** Pratinjau dampak pengakhiran season (tidak mengubah data apa pun). */
export async function previewTransition(seasonId: string): Promise<TransitionPreview | null> {
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) });
  if (!season) return null;

  const rows = await db
    .select({
      uuid: entitlements.uuid,
      playerName: entitlements.playerName,
      productName: products.name,
    })
    .from(entitlements)
    .innerJoin(products, eq(products.id, entitlements.productId))
    .where(and(eq(entitlements.seasonId, seasonId), eq(entitlements.active, true)));

  const byPlayer = new Map<string, { playerName: string | null; products: string[] }>();
  for (const row of rows) {
    const entry = byPlayer.get(row.uuid) ?? { playerName: row.playerName, products: [] };
    entry.products.push(row.productName);
    byPlayer.set(row.uuid, entry);
  }

  const next = await db
    .select()
    .from(seasons)
    .where(and(ne(seasons.id, seasonId), eq(seasons.status, "UPCOMING")))
    .orderBy(seasons.startAt)
    .limit(1);

  return {
    season,
    nextSeason: next[0] ?? null,
    activeEntitlements: rows.length,
    affectedPlayers: byPlayer.size,
    players: [...byPlayer.entries()].slice(0, 50).map(([uuid, value]) => ({ uuid, ...value })),
    canTransition: season.status !== "ENDED",
    reason: season.status === "ENDED" ? "Season ini sudah berakhir." : null,
  };
}

export interface TransitionResult {
  dryRun: boolean;
  seasonId: string;
  alreadyEnded: boolean;
  entitlementsExpired: number;
  revokeDeliveries: number;
  activatedSeasonId: string | null;
  playersAffected: number;
}

/**
 * Job transisi akhir season. Idempoten dan transaksional:
 * - season lama → ENDED, season berikutnya → ACTIVE
 * - semua entitlement season lama dinonaktifkan
 * - perintah pencabutan diantrekan (pemain offline mendapatkannya saat login)
 * - hitungan kit otomatis reset karena entitlement terikat season
 */
export async function runSeasonTransition(input: {
  seasonId: string;
  dryRun?: boolean;
  actor?: AuditActor;
  reason?: string;
}): Promise<TransitionResult> {
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, input.seasonId) });
  if (!season) throw new Error("Season tidak ditemukan");

  const preview = await previewTransition(input.seasonId);
  if (!preview) throw new Error("Season tidak ditemukan");

  if (season.status === "ENDED") {
    return {
      dryRun: Boolean(input.dryRun),
      seasonId: season.id,
      alreadyEnded: true,
      entitlementsExpired: 0,
      revokeDeliveries: 0,
      activatedSeasonId: null,
      playersAffected: 0,
    };
  }

  if (input.dryRun) {
    return {
      dryRun: true,
      seasonId: season.id,
      alreadyEnded: false,
      entitlementsExpired: preview.activeEntitlements,
      revokeDeliveries: preview.activeEntitlements,
      activatedSeasonId: preview.nextSeason?.id ?? null,
      playersAffected: preview.affectedPlayers,
    };
  }

  // Siapkan perintah pencabutan di luar transaksi.
  const activeRows = await db
    .select({
      id: entitlements.id,
      uuid: entitlements.uuid,
      playerName: entitlements.playerName,
      productId: entitlements.productId,
      productSlug: products.slug,
      productName: products.name,
    })
    .from(entitlements)
    .innerJoin(products, eq(products.id, entitlements.productId))
    .where(and(eq(entitlements.seasonId, season.id), eq(entitlements.active, true)));

  const prepared: Array<{ uuid: string; playerName: string; productId: string; commands: string[] }> = [];
  for (const row of activeRows) {
    const commands = await buildRevokeCommands({
      productId: row.productId,
      player: row.playerName ?? row.uuid,
      uuid: row.uuid,
      seasonSlug: season.slug,
    });
    prepared.push({
      uuid: row.uuid,
      playerName: row.playerName ?? row.uuid,
      productId: row.productId,
      commands,
    });
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM seasons WHERE id = ${season.id} FOR UPDATE`);
    const current = await tx.query.seasons.findFirst({ where: eq(seasons.id, season.id) });
    if (!current || current.status === "ENDED") {
      return {
        alreadyEnded: true,
        entitlementsExpired: 0,
        revokeDeliveries: 0,
        activatedSeasonId: null,
      };
    }

    // 1. Tutup season lama lebih dulu agar unique index "satu season aktif" terpenuhi.
    await tx
      .update(seasons)
      .set({ status: "ENDED", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(seasons.id, season.id));

    // 2. Aktifkan season berikutnya bila sudah dijadwalkan.
    const next = await tx
      .select()
      .from(seasons)
      .where(and(ne(seasons.id, season.id), eq(seasons.status, "UPCOMING")))
      .orderBy(seasons.startAt)
      .limit(1);
    if (next[0]) {
      await tx
        .update(seasons)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(eq(seasons.id, next[0].id));
    }

    // 3. Gugurkan semua entitlement season lama.
    const expired = await tx
      .update(entitlements)
      .set({ active: false, revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(entitlements.seasonId, season.id), eq(entitlements.active, true)))
      .returning({ id: entitlements.id });

    // 4. Antrekan pencabutan rank/kit di server.
    let revokeDeliveries = 0;
    for (const entry of prepared) {
      if (entry.commands.length === 0) continue;
      await tx.insert(deliveries).values({
        id: ids.delivery(),
        orderId: null,
        seasonId: season.id,
        uuid: entry.uuid,
        playerName: entry.playerName,
        productId: entry.productId,
        status: "QUEUED",
        commands: entry.commands,
      });
      revokeDeliveries += 1;
    }

    return {
      alreadyEnded: false,
      entitlementsExpired: expired.length,
      revokeDeliveries,
      activatedSeasonId: next[0]?.id ?? null,
    };
  });

  if (!result.alreadyEnded) {
    await writeAudit({
      actor: input.actor ?? { id: null, label: "system:season-transition" },
      action: "season.transition",
      targetType: "season",
      targetId: season.id,
      before: { status: season.status },
      after: {
        status: "ENDED",
        entitlementsExpired: result.entitlementsExpired,
        revokeDeliveries: result.revokeDeliveries,
        activatedSeasonId: result.activatedSeasonId,
      },
      reason: input.reason ?? "Transisi otomatis/manual akhir season",
    });
    await alertStaff({
      kind: "SYSTEM",
      title: `${season.name} berakhir`,
      body: `${result.entitlementsExpired} entitlement digugurkan, ${result.revokeDeliveries} perintah pencabutan diantrekan.`,
      href: "/admin/season",
    });
    if (prepared.length > 0) await enqueue("delivery.process", { allDue: true }, { dedupeKey: `season-revoke:${season.id}` });
  }

  logger.info("season_transition_done", { seasonId: season.id, ...result });
  return {
    dryRun: false,
    seasonId: season.id,
    alreadyEnded: result.alreadyEnded,
    entitlementsExpired: result.entitlementsExpired,
    revokeDeliveries: result.revokeDeliveries,
    activatedSeasonId: result.activatedSeasonId,
    playersAffected: preview.affectedPlayers,
  };
}

/** Dipanggil dari cron: mengakhiri season yang sudah melewati endAt. */
export async function transitionDueSeasons(now = new Date()): Promise<TransitionResult[]> {
  const due = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.status, "ACTIVE"), isNull(seasons.endedAt)));
  const results: TransitionResult[] = [];
  for (const season of due) {
    if (season.endAt.getTime() > now.getTime()) continue;
    results.push(await runSeasonTransition({ seasonId: season.id, reason: "endAt terlewati (cron)" }));
  }
  return results;
}

/** Pemain terdampak untuk pratinjau admin (UUID + nama). */
export async function affectedPlayersForSeason(seasonId: string) {
  const rows = await db
    .select({ uuid: entitlements.uuid, playerName: entitlements.playerName })
    .from(entitlements)
    .where(eq(entitlements.seasonId, seasonId));
  return rows;
}

/** Email pengingat H-7 dan H-1 ke pembeli season aktif. */
export async function sendSeasonReminders(now = new Date()): Promise<{ sent: number }> {
  const active = await db.query.seasons.findFirst({ where: eq(seasons.status, "ACTIVE") });
  if (!active) return { sent: 0 };
  const daysLeft = Math.ceil((active.endAt.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft !== 7 && daysLeft !== 1) return { sent: 0 };

  const recipients = await db
    .selectDistinct({ email: orders.email })
    .from(orders)
    .where(and(eq(orders.seasonId, active.id), inArray(orders.status, ["PAID", "DELIVERING", "DELIVERED"])));

  for (const recipient of recipients) {
    const user = await db.query.users.findFirst({ where: eq(users.email, recipient.email) });
    await enqueue(
      "email.send",
      {
        template: "season.ending",
        seasonId: active.id,
        email: recipient.email,
        username: user?.username ?? recipient.email.split("@")[0],
        daysLeft,
      },
      { dedupeKey: `season-reminder:${active.id}:${daysLeft}:${recipient.email}` },
    );
  }
  return { sent: recipients.length };
}
