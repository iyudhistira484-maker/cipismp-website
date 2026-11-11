import Link from "next/link";
import type { Metadata } from "next";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/content/faq";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Pertanyaan umum tentang rank, kit, pembayaran, dan masa aktif season CipiSMP.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const settings = await getSettings();
  return (
    <div className="container-page max-w-3xl py-12 lg:py-16">
      <p className="eyebrow">FAQ</p>
      <h1 className="mt-2 font-display text-h1 text-ink">Pertanyaan umum</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Jawaban singkat, tanpa syarat tersembunyi. Kalau ada yang belum jelas, tanyakan sebelum membeli.
      </p>

      <Accordion type="single" collapsible className="mt-8 border-t-0" defaultValue={FAQ_ITEMS[0]?.id}>
        {FAQ_ITEMS.map((item) => (
          <AccordionItem key={item.id} value={item.id} question={item.question}>
            <p>{item.answer}</p>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-10 rounded-lg border border-line bg-surface/50 p-5">
        <h2 className="font-display text-[16px] text-ink">Masih butuh bantuan?</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Email{" "}
          <a href={`mailto:${settings.site.supportEmail}`} className="text-accent hover:underline">
            {settings.site.supportEmail}
          </a>{" "}
          dengan menyertakan username Minecraft dan nomor order (bila ada). Kami membalas pada jam kerja
          WIB. Untuk masalah pembayaran, sertakan bukti transfer.
        </p>
        <p className="mt-2 text-2xs text-muted-2">
          Kami tidak pernah meminta password, kode OTP, atau pembayaran ulang lewat DM.
        </p>
      </div>

      <p className="mt-6 text-[13px] text-muted">
        Baca juga{" "}
        <Link href="/legal/syarat-penjualan" className="text-accent hover:underline">
          syarat penjualan
        </Link>{" "}
        dan{" "}
        <Link href="/legal/syarat-layanan" className="text-accent hover:underline">
          syarat layanan
        </Link>
        .
      </p>
    </div>
  );
}
