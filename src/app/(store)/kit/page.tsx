import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { KitCard } from "@/components/store/product-cards";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { getActiveSeason, getKitItemsForProducts, getPublishedProducts } from "@/server/catalog";
import { ratingMap } from "@/server/reviews";
import { isPurchaseFrozen } from "@/lib/seasons";
import { formatDateWIB } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Kit",
  description:
    "Kit musiman CipiSMP: Starter, Builder, dan Explorer. Satu kali per pemain setiap season, berlaku sampai akhir season.",
  alternates: { canonical: "/kit" },
};

export default async function KitListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [all, season] = await Promise.all([getPublishedProducts("KIT"), getActiveSeason()]);
  const ratings = await ratingMap(all.map((kit) => kit.id));
  const items = await getKitItemsForProducts(all.map((k) => k.id));
  const itemsByProduct = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByProduct.get(item.productId) ?? [];
    list.push(item);
    itemsByProduct.set(item.productId, list);
  }

  const query = q.trim().toLowerCase();
  const kits = query
    ? all.filter(
        (kit) =>
          kit.name.toLowerCase().includes(query) ||
          kit.tagline.toLowerCase().includes(query) ||
          (itemsByProduct.get(kit.id) ?? []).some((item) => item.name.toLowerCase().includes(query)),
      )
    : all;
  const frozen = season ? isPurchaseFrozen(season) : false;

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Kit · {season?.name ?? "Belum ada season"}</p>
        <h1 className="mt-2 text-balance font-display text-h1 text-ink">
          Isi kit yang jelas, tanpa kotak misterius.
        </h1>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted">
          Setiap kit menampilkan isinya secara lengkap. Semua kit dibatasi satu kali per pemain setiap
          season dan berakhir bersama season.
          {season ? ` Season ini berakhir ${formatDateWIB(season.endAt)}.` : ""}
        </p>
      </div>

      {frozen && season ? (
        <Alert tone="warning" className="mt-6 max-w-2xl" title="Pembelian sedang ditutup">
          Pembelian ditutup pada {season.freezeDays} hari terakhir season. Kit yang sudah dimiliki tetap
          bisa diambil sampai season berakhir.
        </Alert>
      ) : null}

      <form method="get" className="mt-8 flex max-w-md items-center gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Cari kit atau nama item…" className="pl-9" aria-label="Cari kit" />
        </div>
        <button
          type="submit"
          className="h-11 rounded-md border border-line-strong bg-surface-2 px-4 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
        >
          Cari
        </button>
      </form>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((kit) => (
          <KitCard
            key={kit.id}
            product={kit}
            items={itemsByProduct.get(kit.id) ?? []}
            season={season ? { name: season.name, endAt: season.endAt } : null}
            rating={ratings.get(kit.id)}
          />
        ))}
      </div>

      {kits.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] text-ink">Tidak ada kit yang cocok dengan “{q}”.</p>
          <Link href="/kit" className="mt-2 inline-block text-[13px] text-accent hover:underline">
            Tampilkan semua kit
          </Link>
        </div>
      ) : null}
    </div>
  );
}
