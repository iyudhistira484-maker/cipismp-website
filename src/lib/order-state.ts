/**
 * State machine order CipiSMP Store.
 *
 * PENDING → PAID → DELIVERING → DELIVERED
 *             ↘ EXPIRED/CANCELLED (terminal kecuali EXPIRED → PAID untuk webhook telat)
 * PAID/DELIVERING/DELIVERED → DISPUTED (chargeback dari gateway)
 * DELIVERING → FAILED → DELIVERING (retry / kirim ulang oleh admin)
 *
 * TIDAK ADA state REFUNDED. Semua penjualan final.
 */
export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "DELIVERING",
  "DELIVERED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "DISPUTED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "EXPIRED", "CANCELLED"],
  // Pembayaran telat setelah order kedaluwarsa tetap harus diakui (dana sudah masuk).
  EXPIRED: ["PAID"],
  PAID: ["DELIVERING", "DELIVERED", "DISPUTED", "FAILED"],
  DELIVERING: ["DELIVERED", "FAILED", "DISPUTED"],
  FAILED: ["DELIVERING", "DELIVERED", "DISPUTED"],
  DELIVERED: ["DISPUTED"],
  DISPUTED: ["DELIVERED"],
  CANCELLED: [],
};

export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Transisi order tidak valid: ${from} → ${to}`);
    this.name = "InvalidOrderTransitionError";
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidOrderTransitionError(from, to);
}

/** Status yang mengizinkan proses pengiriman item. */
export function isDeliverable(status: OrderStatus): boolean {
  return status === "PAID" || status === "DELIVERING" || status === "FAILED";
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "DELIVERED" || status === "CANCELLED" || status === "DISPUTED";
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Menunggu pembayaran",
  PAID: "Sudah dibayar",
  DELIVERING: "Sedang dikirim",
  DELIVERED: "Selesai",
  FAILED: "Gagal dikirim",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  DISPUTED: "Sengketa",
};

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  QUEUED: "Dalam antrean",
  SENT: "Terkirim ke server",
  DELIVERED: "Diterima pemain",
  FAILED: "Gagal, akan dicoba lagi",
  DEAD: "Gagal permanen",
};
