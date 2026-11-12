import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDown, ArrowRight, BookOpen, CircleHelp, CreditCard, Gamepad2, HeartHandshake, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { DecorativeVideoBackground } from "@/components/store/decorative-video-background";
import { FAQ_ITEMS } from "@/content/faq";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Pertanyaan umum tentang rank, kit, pembayaran, dan masa aktif season CipiSMP.",
  alternates: { canonical: "/faq" },
};

const TOPICS = [
  {
    id: "rank-dan-season",
    label: "Rank & season",
    description: "Masa aktif dan upgrade rank.",
    icon: Sparkles,
  },
  {
    id: "pemain-dan-pengiriman",
    label: "Pemain & pengiriman",
    description: "Bedrock, hadiah, dan akses di server.",
    icon: Gamepad2,
  },
  {
    id: "pembayaran-dan-refund",
    label: "Pembayaran & refund",
    description: "Metode pembayaran dan kebijakan pembelian.",
    icon: CreditCard,
  },
] as const;

export default async function FaqPage() {
  const settings = await getSettings();

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="relative isolate overflow-hidden rounded-[24px] bg-[#332331] px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
        <DecorativeVideoBackground
          src="https://motionbgs.com/media/3761/christmas-in-minecraft.960x540.mp4"
          poster="/images/gameplay/forest-path.webp"
          className="faq-video absolute inset-0 -z-10 overflow-hidden bg-[#332331] bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center"
          overlayClassName="absolute inset-0 bg-gradient-to-r from-[#261925]/95 via-[#30212f]/85 to-[#30212f]/65"
        />
        <div className="relative max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#ffe0ee]">
            <CircleHelp className="size-3.5" aria-hidden /> CipiSMP Help Center
          </p>
          <h1 className="mt-5 font-display text-[clamp(2.2rem,5vw,3.7rem)] leading-[1.06] tracking-[-.04em] text-white">Ada pertanyaan?<br /><span className="text-[#f6b6d1]">Kami bantu jawab.</span></h1>
          <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-white/90 sm:text-[15px]">Temukan jawaban seputar rank, kit, pembayaran, dan perjalananmu di CipiSMP. Pilih topik di bawah untuk mulai.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {TOPICS.map(({ id, label }) => <a key={id} href={`#${id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#eadce6] bg-white/85 px-4 text-[12px] font-semibold text-ink transition-colors hover:border-accent/40 hover:text-accent-strong">{label} <ArrowDown className="size-3.5" aria-hidden /></a>)}
          </div>
        </div>
      </header>

      <div className="mt-7 grid items-start gap-6 lg:mt-9 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
        <div className="min-w-0 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
            <div><p className="eyebrow">Pusat bantuan</p><h2 className="mt-1 font-display text-[25px] text-ink">Pertanyaan umum<span className="text-accent">.</span></h2><p className="mt-1 text-[13px] leading-relaxed text-muted">Jawaban singkat untuk hal-hal yang sering ditanyakan.</p></div>
            <span className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-muted">{FAQ_ITEMS.length} pertanyaan</span>
          </div>
          {TOPICS.map((topic) => {
            const Icon = topic.icon;
            const items = FAQ_ITEMS.filter((item) => item.category === topic.id);
            return (
              <section id={topic.id} key={topic.id} aria-labelledby={`${topic.id}-heading`} className="scroll-mt-24">
                <div className="mb-4 flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#f1e1eb] bg-[#fbf1f7] text-accent-strong"><Icon className="size-5" aria-hidden /></span>
                  <div><h3 id={`${topic.id}-heading`} className="font-display text-[19px] text-ink">{topic.label}</h3><p className="mt-0.5 text-[12px] leading-relaxed text-muted">{topic.description}</p></div>
                </div>
                <div className="overflow-hidden rounded-[20px] border border-line bg-white px-4 shadow-card sm:px-6">
                  <Accordion type="single" collapsible className="border-0">
                    {items.map((item) => <AccordionItem key={item.id} value={item.id} question={item.question}><p>{item.answer}</p></AccordionItem>)}
                  </Accordion>
                </div>
              </section>
            );
          })}
        </div>

        <aside aria-label="Bantuan lebih lanjut" className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-[22px] border border-[#ead9e6] bg-[#fcf4f9] p-6">
            <span className="grid size-11 place-items-center rounded-2xl bg-white text-accent-strong shadow-sm"><HeartHandshake className="size-5" aria-hidden /></span>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[.14em] text-accent-strong">We're here for you</p>
            <h2 className="mt-1 font-display text-[22px] leading-tight text-ink">Masih butuh bantuan?</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">Ceritakan kendalamu lewat email. Sertakan username Minecraft dan nomor pesanan jika ada; untuk masalah pembayaran, sertakan bukti transfer.</p>
            <a href={`mailto:${settings.site.supportEmail}`} className="mt-5 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl bg-accent-strong px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#872454]"><Mail className="size-4 shrink-0" aria-hidden /><span className="break-all">{settings.site.supportEmail}</span></a>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">Kami membalas pada jam kerja WIB.</p>
          </section>
          <section className="rounded-[22px] border border-line bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden /><div><h2 className="font-display text-[16px] text-ink">Tetap aman, ya!</h2><p className="mt-2 text-[12px] leading-relaxed text-muted">Kami tidak pernah meminta password, kode OTP, atau pembayaran ulang lewat DM.</p></div></div>
          </section>
          <section className="rounded-[22px] border border-line bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3"><BookOpen className="mt-0.5 size-5 shrink-0 text-[#9273a5]" aria-hidden /><div><h2 className="font-display text-[16px] text-ink">Panduan lainnya</h2><p className="mt-2 text-[12px] leading-relaxed text-muted">Kenali alur pembelian dan ketentuan sebelum berpetualang.</p><div className="mt-3 flex flex-col items-start gap-2 text-[12px] font-semibold text-accent-strong"><Link href="/cara-kerja" className="inline-flex items-center gap-1 hover:underline">Cara kerja <ArrowRight className="size-3.5" aria-hidden /></Link><Link href="/legal/syarat-penjualan" className="hover:underline">Syarat penjualan</Link><Link href="/legal/syarat-layanan" className="hover:underline">Syarat layanan</Link></div></div></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
