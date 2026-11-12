import type { OrderStatus } from "./order-state";

/** Pesan aman bagi pelanggan; tidak memaparkan error atau perintah internal server. */
export function orderTrackingMessage(status: OrderStatus, paymentStatus?: string | null) {
  if (paymentStatus === "UNDERPAID" && status === "PENDING") return { title: "Pembayaran perlu diperiksa", body: "Nominal yang diterima belum mencukupi. Hubungi bantuan dengan nomor pesanan; jangan membayar ulang sebelum mendapat arahan.", needsHelp: true };
  switch (status) {
    case "PENDING": return { title: "Menunggu pembayaran", body: "Selesaikan pembayaran sebelum batas waktu. Status diperbarui setelah konfirmasi gateway.", needsHelp: false };
    case "PAID": return { title: "Pembayaran terkonfirmasi", body: "Pembayaran tercatat. Pengiriman akan diproses oleh server.", needsHelp: false };
    case "DELIVERING": return { title: "Pengiriman sedang diproses", body: "Periksa status tiap item di bawah. Pengiriman mungkin menunggu pemain atau server.", needsHelp: false };
    case "DELIVERED": return { title: "Pesanan tercatat selesai", body: "Pesanan tercatat selesai di toko. Jika akses belum terlihat di game, hubungi bantuan dengan nomor pesanan.", needsHelp: false };
    case "FAILED": return { title: "Pengiriman perlu bantuan", body: "Pengiriman belum berhasil. Tim dapat memeriksa dan mencoba kembali; sertakan nomor pesanan.", needsHelp: true };
    case "EXPIRED": return { title: "Pesanan kedaluwarsa", body: "Batas pembayaran telah lewat. Jika sudah membayar, hubungi bantuan dengan bukti pembayaran sebelum membuat pesanan baru.", needsHelp: true };
    case "CANCELLED": return { title: "Pesanan dibatalkan", body: "Pesanan ini tidak lagi diproses. Jika pembayaran sudah dilakukan, hubungi bantuan.", needsHelp: false };
    case "DISPUTED": return { title: "Pembayaran dalam peninjauan", body: "Pesanan sedang ditinjau. Hubungi bantuan dengan nomor pesanan untuk informasi lebih lanjut.", needsHelp: true };
  }
}

export function deliveryTrackingMessage(status: string) {
  switch (status) {
    case "QUEUED": return "Menunggu antrean pengiriman.";
    case "SENT": return "Pengiriman sedang berlangsung atau hasilnya belum pasti; menunggu pemeriksaan.";
    case "DELIVERED": return "Pengiriman tercatat selesai; periksa akses di game.";
    case "FAILED": return "Pengiriman belum berhasil; hubungi bantuan jika belum berlanjut.";
    case "DEAD": return "Pengiriman belum berhasil dan perlu diperiksa tim bantuan.";
    default: return "Status pengiriman belum tersedia.";
  }
}
