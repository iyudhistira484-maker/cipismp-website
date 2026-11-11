import type { Metadata } from "next";
import { OrderLookupForm } from "@/components/store/order-lookup-form";

export const metadata: Metadata = {
  title: "Cek status pesanan",
  description: "Cek status pesanan CipiSMP Store dengan nomor order dan email pembelian.",
};

export default function OrderLookupPage() {
  return (
    <div className="container-page max-w-xl py-14 lg:py-20">
      <p className="eyebrow">Status pesanan</p>
      <h1 className="mt-2 font-display text-h1 text-ink">Cari pesananmu</h1>
      <p className="mt-3 text-pretty text-[14.5px] leading-relaxed text-muted">
        Masukkan nomor order (format <span className="font-pixel text-[11px] text-ink">CIPS-XXXXXXXX</span>) dan
        email yang dipakai saat membeli. Kami tidak mengirim nomor order lewat halaman ini, jadi hanya
        pemilik email yang bisa membuka pesanan.
      </p>
      <OrderLookupForm />
      <div className="mt-8 rounded-lg border border-line bg-surface/50 p-4 text-[12.5px] leading-relaxed text-muted">
        <p className="font-medium text-ink">Tidak menemukan email konfirmasi?</p>
        <p className="mt-1">
          Periksa folder spam/promosi. Email pengirim adalah <span className="text-ink">no-reply@cipismp.my.id</span>.
          Kalau tetap tidak ada, hubungi bantuan dengan menyertakan username Minecraft dan waktu pembelian.
        </p>
      </div>
    </div>
  );
}
