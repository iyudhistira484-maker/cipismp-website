import type { OrderStatus } from "./order-state";

export type TimelineState = "complete" | "current" | "attention" | "upcoming";
export type OrderTimelineStep = { key: "waiting" | "paid" | "delivery" | "done"; label: string; state: TimelineState; hint: string; date?: Date | null };

/** Progress is based on the current order record, not an invented event history. */
export function orderTimeline(input: { status: OrderStatus; paymentStatus?: string | null; paidAt?: Date | null; deliveredAt?: Date | null }): OrderTimelineStep[] {
  const { status, paymentStatus, paidAt, deliveredAt } = input;
  const steps: OrderTimelineStep[] = [
    { key: "waiting", label: "Menunggu pembayaran", state: "upcoming", hint: "Menunggu konfirmasi pembayaran." },
    { key: "paid", label: "Dibayar", state: "upcoming", hint: "Pembayaran belum terkonfirmasi." },
    { key: "delivery", label: "Pengiriman", state: "upcoming", hint: "Pengiriman belum selesai." },
    { key: "done", label: "Selesai", state: "upcoming", hint: "Pesanan belum tercatat selesai." },
  ];
  const [waiting, paid, delivery, done] = steps as [OrderTimelineStep, OrderTimelineStep, OrderTimelineStep, OrderTimelineStep];
  const completedPayment = () => {
    waiting.state = "complete"; waiting.hint = "Tahap pembayaran terlewati.";
    paid.state = "complete"; paid.hint = "Pembayaran terkonfirmasi."; paid.date = paidAt;
  };
  if (status === "PENDING") {
    waiting.state = paymentStatus === "UNDERPAID" ? "attention" : "current";
    waiting.hint = paymentStatus === "UNDERPAID" ? "Nominal kurang; perlu pemeriksaan." : "Selesaikan pembayaran sebelum batas waktu.";
  } else if (status === "EXPIRED" || status === "CANCELLED") {
    waiting.state = "attention";
    waiting.hint = status === "EXPIRED" ? "Batas pembayaran terlewati." : "Pesanan dibatalkan.";
  } else if (status === "DISPUTED") {
    if (paidAt) { waiting.state = "complete"; waiting.hint = "Tahap pembayaran terlewati."; }
    paid.state = "attention"; paid.hint = "Pembayaran dalam peninjauan."; paid.date = paidAt;
    delivery.hint = "Lihat catatan item untuk detail pengiriman.";
    done.hint = deliveredAt ? "Pernah tercatat selesai; pesanan kini ditinjau." : "Pesanan sedang ditinjau.";
    done.date = deliveredAt;
  } else if (status === "FAILED") {
    if (paidAt) completedPayment();
    delivery.state = "attention"; delivery.hint = "Pengiriman perlu diperiksa.";
  } else {
    completedPayment();
    if (status === "PAID") { paid.state = "current"; delivery.hint = "Menunggu proses pengiriman."; }
    if (status === "DELIVERING") { delivery.state = "current"; delivery.hint = "Pengiriman sedang diproses."; }
    if (status === "DELIVERED") {
      delivery.state = "complete"; delivery.hint = "Tahap pengiriman tercatat selesai.";
      done.state = "current"; done.hint = "Pesanan tercatat selesai di toko."; done.date = deliveredAt;
    }
  }
  return steps;
}
