/** Utilitas uang. Semua nominal rupiah adalah integer; tidak pernah float. */

export const CURRENCY = "IDR" as const;

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/** "Rp 20.000" — tanpa spasi non-breaking bawaan Intl. */
export function formatRp(amount: number): string {
  return formatIDR(amount).replace(/\u00a0/g, " ");
}

/** Persen dengan pembulatan half-up, hasil integer rupiah. */
export function percentOf(amount: number, percent: number): number {
  if (percent <= 0) return 0;
  return Math.round((amount * percent) / 100);
}

export function clampNonNegative(n: number): number {
  return n > 0 ? n : 0;
}

/** Mengubah input pengguna ("20.000", "Rp 20.000", "20000") menjadi integer. */
export function parseIdr(input: string): number | null {
  // Nilai negatif harus ditolak, bukan dipaksa menjadi positif oleh pembersihan.
  if (input.includes("-")) return null;
  const cleaned = input.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const value = Number.parseInt(cleaned, 10);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

/** Total tidak pernah negatif dan tidak pernah melebihi subtotal setelah diskon. */
export function computeTotal(subtotal: number, discount: number, tax: number, fee: number): number {
  return clampNonNegative(subtotal - Math.min(discount, subtotal) + tax + fee);
}
