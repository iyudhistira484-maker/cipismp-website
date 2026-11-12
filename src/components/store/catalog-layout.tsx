import Link from "next/link";
import { ArrowRight, CalendarDays, Crown, PackageOpen, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/field";
import { DecorativeVideoBackground } from "@/components/store/decorative-video-background";
import { formatDateWIB } from "@/lib/dates";

export function CatalogHero({ type, season, count }: { type: "rank" | "kit"; season: { name: string; endAt: Date } | null; count: number }) {
  const rank = type === "rank";
  const Icon = rank ? Crown : PackageOpen;
  return (
    <header className={`relative isolate overflow-hidden rounded-[24px] px-6 py-9 sm:px-9 sm:py-11 lg:px-12 lg:py-12 ${rank ? "bg-[#203438]" : "bg-[#332331]"}`}>
      {rank ? (
        <DecorativeVideoBackground
          src="https://motionbgs.com/media/531/water-world-minecraft.960x540.mp4"
          poster="/images/gameplay/forest-path.webp"
          className="rank-video absolute inset-0 -z-10 overflow-hidden bg-[#203438] bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center"
          overlayClassName="absolute inset-0 bg-gradient-to-r from-[#14252a]/95 via-[#223538]/85 to-[#223538]/60"
        />
      ) : (
        <DecorativeVideoBackground
          src="https://motionbgs.com/media/1963/fireplace-in-minecraft.960x540.mp4"
          poster="/images/gameplay/forest-path.webp"
          className="kit-video absolute inset-0 -z-10 overflow-hidden bg-[#332331] bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center"
          overlayClassName="absolute inset-0 bg-gradient-to-r from-[#261925]/95 via-[#3b2938]/85 to-[#3b2938]/60"
        />
      )}
      <div className="relative grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#ffe0ee]"><Sparkles className="size-3.5" aria-hidden /> CipiSMP Store · {rank ? "Rank" : "Kit"}</p>
          <h1 className="mt-5 text-balance font-display text-[clamp(2.2rem,5vw,3.65rem)] leading-[1.06] tracking-[-.04em] text-white">{rank ? <>Temukan rank <span className="text-[#f6b6d1]">versimu.</span></> : <>Bekal untuk <span className="text-[#f6b6d1]">petualanganmu.</span></>}</h1>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-white/90 sm:text-[15px]">{rank ? "Pilih rank yang cocok untuk cara bermainmu. Bandingkan keuntungan, harga, dan masa aktif sebelum membeli." : "Jelajahi isi setiap kit sebelum memilih. Akses PlayerKits berlaku per season, dengan cooldown klaim 5 jam yang diatur server."}</p>
          <div className="mt-6 flex flex-wrap gap-2.5"><a href="#katalog" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-strong px-4 text-[12px] font-semibold text-white hover:bg-[#872454]">Lihat {rank ? "rank" : "kit"} <ArrowRight className="size-4" aria-hidden /></a><Link href={rank ? "/kit" : "/rank"} className="inline-flex min-h-11 items-center rounded-xl border border-[#e5d1df] bg-white/80 px-4 text-[12px] font-semibold text-ink hover:bg-white">Jelajahi {rank ? "kit" : "rank"}</Link></div>
        </div>
        <div className="rounded-[20px] border border-white/90 bg-white/75 p-5 shadow-card backdrop-blur-sm sm:p-6">
          <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f9e7f1] text-accent-strong"><Icon className="size-5" aria-hidden /></span><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-2">Pilihan musim ini</p><p className="mt-1 font-display text-[18px] text-ink">{count} {rank ? "rank" : "kit"} di katalog</p></div></div>
          <div className="mt-4 flex items-start gap-2.5 border-t border-line pt-4"><CalendarDays className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><p className="text-[12px] leading-relaxed text-muted">{season ? <><span className="font-semibold text-ink">{season.name}</span> · sampai {formatDateWIB(season.endAt)}</> : "Belum ada season aktif."}</p></div>
        </div>
      </div>
    </header>
  );
}

export function CatalogToolbar({ type, query, count }: { type: "rank" | "kit"; query: string; count: number }) {
  const rank = type === "rank";
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="eyebrow">Katalog {type}</p><h2 id="catalog-heading" className="mt-1 font-display text-[25px] text-ink">{rank ? "Pilih rank favoritmu" : "Temukan kit yang cocok"}<span className="text-accent">.</span></h2><p className="mt-1 text-[12.5px] text-muted">{query.trim() ? `${count} hasil ditemukan` : `${count} ${type} ditampilkan`}</p></div>
      <form method="get" role="search" className="flex w-full min-w-0 gap-2 lg:max-w-sm"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" aria-hidden /><Input name="q" defaultValue={query} placeholder={rank ? "Cari rank atau keuntungan…" : "Cari kit atau nama item…"} className="bg-white pl-9" aria-label={`Cari ${type}`} /></div><button type="submit" className="h-11 shrink-0 rounded-xl border border-line-strong bg-white px-4 text-[13px] font-semibold text-ink hover:border-accent/40 hover:text-accent-strong">Cari</button></form>
    </div>
  );
}

export function CatalogEmpty({ type, query }: { type: "rank" | "kit"; query: string }) {
  const searched = Boolean(query.trim());
  return <div className="mt-5 rounded-[20px] border border-dashed border-[#e8d6e2] bg-white px-6 py-12 text-center"><p className="font-display text-[17px] text-ink">{searched ? <>Tidak ada {type} yang cocok dengan “<span className="break-all">{query}</span>”.</> : <>Belum ada {type} yang tersedia.</>}</p>{searched ? <Link href={`/${type}`} className="mt-3 inline-block text-[12px] font-semibold text-accent-strong hover:underline">Tampilkan semua {type}</Link> : null}</div>;
}
