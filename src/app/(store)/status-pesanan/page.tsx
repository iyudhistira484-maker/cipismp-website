import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CircleHelp, FileSearch, Mail, ShieldCheck } from "lucide-react";
import { OrderLookupForm } from "@/components/store/order-lookup-form";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = {
  title: "Cek status pesanan",
  description: "Cek status pesanan CipiSMP Store dengan nomor order dan email pembelian.",
};

export default async function OrderLookupPage() {
  const settings = await getSettings();
  return (
    <div className="container-page py-8 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="relative isolate overflow-hidden rounded-[24px] bg-[#493342] px-6 py-10 text-white sm:px-10 sm:py-12">
          <div className="absolute inset-0 -z-10 bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center" aria-hidden />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#291c29]/95 via-[#3e2a3c]/90 to-[#3e2a3c]/70" aria-hidden />
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#ffe0ee]"><FileSearch className="size-3.5" aria-hidden /> Order tracking</p>
          <h1 className="mt-5 font-display text-[clamp(2.1rem,5vw,3.4rem)] leading-[1.06] tracking-[-.04em] text-white">Cari pesananmu<span className="text-[#f6b6d1]">.</span></h1>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-white/90">Pantau pembayaran dan perjalanan pesananmu dengan nomor order dan email yang digunakan saat membeli.</p>
        </header>
        <div className="mt-6 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(235px,.65fr)] lg:gap-7">
          <section aria-labelledby="lookup-heading" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-7">
            <p className="eyebrow">Detail pembelian</p><h2 id="lookup-heading" className="mt-1 font-display text-[23px] text-ink">Temukan pesanan<span className="text-accent">.</span></h2><p className="mt-2 text-[13px] leading-relaxed text-muted">Isi sesuai yang tertera pada email konfirmasi pembelian.</p>
            <OrderLookupForm />
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-[#f9f3f7] p-3.5 text-[11.5px] leading-relaxed text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden /><p>Nomor pesanan dan email digunakan untuk membuka tautan pesanan. Jaga keduanya dan tautan status tetap pribadi.</p></div>
          </section>
          <aside aria-label="Bantuan pesanan" className="space-y-4">
            <section className="rounded-[22px] border border-[#ebdce9] bg-[#f9f4f9] p-5 sm:p-6"><span className="grid size-10 place-items-center rounded-xl bg-white text-accent-strong"><Mail className="size-5" aria-hidden /></span><h2 className="mt-4 font-display text-[18px] text-ink">Tidak menemukan email?</h2><p className="mt-2 text-[12.5px] leading-relaxed text-muted">Periksa folder spam atau promosi. Jika masih belum ditemukan, hubungi kami dengan username Minecraft dan waktu pembelian.</p><a href={`mailto:${settings.site.supportEmail}`} className="mt-4 inline-flex max-w-full items-center gap-1.5 break-all text-[12px] font-semibold text-accent-strong hover:underline">{settings.site.supportEmail} <ArrowRight className="size-3.5 shrink-0" aria-hidden /></a></section>
            <section className="rounded-[22px] border border-line bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><CircleHelp className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden /><div><h2 className="font-display text-[16px] text-ink">Butuh panduan?</h2><p className="mt-2 text-[12px] leading-relaxed text-muted">Cari jawaban tentang pembayaran dan pengiriman di FAQ.</p><Link href="/faq" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Buka FAQ <ArrowRight className="size-3.5" aria-hidden /></Link></div></div></section>
          </aside>
        </div>
      </div>
    </div>
  );
}
