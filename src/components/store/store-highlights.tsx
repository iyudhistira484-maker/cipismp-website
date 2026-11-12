import { Gamepad2, ListChecks, PackageCheck } from "lucide-react";
import { ScrollReveal } from "@/components/store/scroll-reveal";

const HIGHLIGHTS = [
  {
    Icon: Gamepad2,
    title: "Java & Bedrock",
    description: "Main dari edisi yang kamu gunakan. Alamat server tersedia di panel status.",
  },
  {
    Icon: ListChecks,
    title: "Detail sebelum checkout",
    description: "Cek harga, keuntungan rank, masa aktif, dan isi kit sebelum membayar.",
  },
  {
    Icon: PackageCheck,
    title: "Pengiriman otomatis",
    description: "Item dikirim setelah pembayaran terverifikasi. Jika offline, item menunggu sampai login.",
  },
];

export function StoreHighlights() {
  return (
    <section aria-labelledby="store-highlights-heading" className="container-page py-12 sm:py-14">
      <ScrollReveal className="mb-7 max-w-2xl">
        <p className="eyebrow">Sebelum bermain</p>
        <h2 id="store-highlights-heading" className="mt-2 text-balance font-display text-h2 text-ink">
          Semua informasi penting, jelas dari awal.
        </h2>
        <p className="mt-3 text-pretty text-[14px] leading-relaxed text-muted">
          Periksa edisi server dan detail pesanan sebelum memilih rank atau kit.
        </p>
      </ScrollReveal>

      <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HIGHLIGHTS.map(({ Icon, title, description }, index) => (
          <ScrollReveal key={title} className="h-full" delay={index * 70}>
            <article className="premium-card-3d h-full rounded-2xl border border-line bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-xl border border-accent/10 bg-surface-2 text-accent-strong">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-2">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 font-display text-[18px] font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-pretty text-[13px] leading-relaxed text-muted">{description}</p>
            </article>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
