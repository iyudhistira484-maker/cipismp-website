/**
 * Waktu & tanggal. Semua perhitungan bisnis memakai Asia/Jakarta (WIB, UTC+7,
 * tanpa DST). Simpan UTC di database, tampilkan dalam WIB.
 */
export const TZ = "Asia/Jakarta";
export const TZ_OFFSET_MINUTES = 7 * 60;
export const MS_DAY = 86_400_000;
export const MS_HOUR = 3_600_000;
export const MS_MINUTE = 60_000;

export function formatDateWIB(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function formatDateShortWIB(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function formatDateTimeWIB(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  }).format(date);
}

export function formatTimeWIB(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  }).format(date);
}

export function formatDateTimeCompact(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  }).format(date);
}

/** Tanggal kalender WIB dalam format YYYY-MM-DD. */
export function jakartaDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * MS_MINUTE);
  return shifted.toISOString().slice(0, 10);
}

/** "3 hari lagi" / "hari ini" / "sudah lewat" — dipakai di UI season. */
export function daysUntil(target: Date, now: Date = new Date()): number {
  return Math.ceil((target.getTime() - now.getTime()) / MS_DAY);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_DAY);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_MINUTE);
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

export function isPast(date: Date, now: Date = new Date()): boolean {
  return date.getTime() <= now.getTime();
}

export function minutesAgo(date: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / MS_MINUTE);
}

/** Rentang musim dalam teks Indonesia: "12 Agu 2026 – 10 Nov 2026". */
export function formatSeasonRange(start: Date, end: Date): string {
  return `${formatDateShortWIB(start)} – ${formatDateShortWIB(end)}`;
}

/** ISO string untuk atribut datetime / metadata. */
export function iso(date: Date): string {
  return date.toISOString();
}
