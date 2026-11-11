import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { RankCard } from "@/components/store/product-cards";
import { Alert } from "@/components/ui/feedback";
import { getActiveSeason, getPublishedProducts } from "@/server/catalog";
import { ratingMap } from "@/server/reviews";
import { isPurchaseFrozen } from "@/lib/seasons";
import { formatDateWIB } from "@/lib/dates";
import { Input } from "@/components/ui/field";

export const metadata: Metadata = {
  title: "Rank",
  description:
    "Pilih rank CipiSMP untuk season ini. Lihat keuntungan, harga, dan masa aktif setiap tier sebelum membeli.",
  alternates: { canonical: "/rank" },
};

export default async function RankListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [all, season] = await Promise.all([getPublishedProducts("RANK"), getActiveSeason()]);
  const ratings = await ratingMap(all.map((rank) => rank.id));
  const query = q.trim().toLowerCase();
  const ranks = query
    ? all.filter(
        (rank) =>
          rank.name.toLowerCase().includes(query) ||
          rank.tagline.toLowerCase().includes(query) ||
          rank.perks.some((perk) => perk.toLowerCase().includes(query)),
      )
    : all;
  const frozen = season ? isPurchaseFrozen(season) : false;

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Rank · {season?.name ?? "Belum ada season"}</p>
        <h1 className="mt-2 text-balance font-display text-h1 text-ink">
          Rank Cipi untuk season ini.
        </h1>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted">
          Rank berlaku sampai akhir season dan tidak diperpanjang otomatis. Kalau kamu sudah punya tier
          lebih rendah, upgrade hanya membayar selisih harga.
          {season ? ` Masa aktif saat ini: sampai ${formatDateWIB(season.endAt)}.` : ""}
        </p>
      </div>

      {frozen && season ? (
        <Alert tone="warning" className="mt-6 max-w-2xl" title="Pembelian sedang ditutup">
          Pembelian ditutup pada {season.freezeDays} hari terakhir season ({formatDateWIB(season.endAt)}).
          Rank yang ada tetap aktif sampai season berakhir.
        </Alert>
      ) : null}

      <form method="get" className="mt-8 flex max-w-md items-center gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" aria-hidden />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Cari rank atau keuntungan…"
            className="pl-9"
            aria-label="Cari rank"
          />
        </div>
        <button
          type="submit"
          className="h-11 rounded-md border border-line-strong bg-surface-2 px-4 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
        >
          Cari
        </button>
      </form>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ranks.map((rank) => (
          <RankCard
            key={rank.id}
            product={rank}
            season={season ? { name: season.name, endAt: season.endAt } : null}
            rating={ratings.get(rank.id)}
          />
        ))}
      </div>

      {ranks.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] text-ink">Tidak ada rank yang cocok dengan “{q}”.</p>
          <Link href="/rank" className="mt-2 inline-block text-[13px] text-accent hover:underline">
            Tampilkan semua rank
          </Link>
        </div>
      ) : null}

      <section className="mt-16 border-t border-line pt-10">
        <h2 className="font-display text-h2 text-ink">Perbandingan tier</h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">
          Semua tier mewarisi keuntungan tier di bawahnya. Tidak ada keuntungan PvP, damage, atau
          pengurangan biaya ekonomi di tier mana pun.
        </p>
        <div className="mt-6 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-line bg-surface-2/60">
                <th scope="col" className="px-4 py-3 font-medium text-muted">Keuntungan</th>
                {all.map((rank) => (
                  <th key={rank.id} scope="col" className="px-4 py-3 text-center font-medium text-ink">
                    {rank.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(
                new Set(
                  all.flatMap((rank) => rank.perks).filter((perk) => !perk.startsWith("Semua keuntungan")),
                ),
              ).map((perk) => (
                <tr key={perk} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-normal text-muted">
                    {perk}
                  </th>
                  {all.map((rank) => (
                    <td key={rank.id} className="px-4 py-3 text-center">
                      {rank.perks.includes(perk) ? (
                        <span className="text-accent" aria-label="Termasuk">●</span>
                      ) : (
                        <span className="text-line-strong" aria-label="Tidak termasuk">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-surface-2/40">
                <th scope="row" className="px-4 py-3 text-left font-medium text-ink">Harga per season</th>
                {all.map((rank) => (
                  <td key={rank.id} className="px-4 py-3 text-center font-medium text-ink">
                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(rank.priceIdr)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
