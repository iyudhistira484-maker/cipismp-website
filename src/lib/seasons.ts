/**
 * Aturan season — fungsi murni. Season menentukan masa berlaku semua rank & kit.
 * Tidak ada expiry per pembelian: validitas diturunkan dari status season.
 */
import { daysUntil, formatDateWIB, MS_DAY } from "./dates";

export type SeasonStatusValue = "UPCOMING" | "ACTIVE" | "ENDED";

export interface SeasonLike {
  id: string;
  name: string;
  slug: string;
  startAt: Date;
  endAt: Date;
  status: SeasonStatusValue;
  freezeDays: number;
}

/** Pembelian ditutup pada N hari terakhir season (default 3). */
export function freezeStartsAt(season: Pick<SeasonLike, "endAt" | "freezeDays">): Date {
  return new Date(season.endAt.getTime() - season.freezeDays * MS_DAY);
}

export function isPurchaseFrozen(season: Pick<SeasonLike, "endAt" | "freezeDays">, now: Date = new Date()): boolean {
  return now.getTime() >= freezeStartsAt(season).getTime();
}

export function canPurchase(
  season: Pick<SeasonLike, "endAt" | "freezeDays" | "status">,
  now: Date = new Date(),
): { ok: boolean; reason: "FROZEN" | "NOT_ACTIVE" | null } {
  if (season.status !== "ACTIVE") return { ok: false, reason: "NOT_ACTIVE" };
  if (isPurchaseFrozen(season, now)) return { ok: false, reason: "FROZEN" };
  return { ok: true, reason: null };
}

export function daysLeftInSeason(season: Pick<SeasonLike, "endAt">, now: Date = new Date()): number {
  return Math.max(0, daysUntil(season.endAt, now));
}

/** Kalimat transparansi yang wajib tampil di produk, keranjang, dan checkout. */
export function activeUntilLabel(season: Pick<SeasonLike, "name" | "endAt">): string {
  return `Aktif sampai akhir ${season.name}, berakhir ${formatDateWIB(season.endAt)}`;
}

/** Status efektif berdasarkan tanggal (dipakai untuk sanity check job). */
export function derivedStatus(
  season: Pick<SeasonLike, "startAt" | "endAt">,
  now: Date = new Date(),
): SeasonStatusValue {
  if (now.getTime() < season.startAt.getTime()) return "UPCOMING";
  if (now.getTime() >= season.endAt.getTime()) return "ENDED";
  return "ACTIVE";
}
