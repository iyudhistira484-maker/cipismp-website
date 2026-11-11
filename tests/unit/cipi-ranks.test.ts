import { describe, expect, it } from "vitest";
import { CIPI_RANKS, sortCipiRanks } from "@/lib/cipi-ranks";

describe("katalog rank CipiSMP", () => {
  it("mengurutkan tier dan harga dari Cute sampai Star dengan group LuckPerms yang benar", () => {
    expect(CIPI_RANKS.map(({ slug, priceIdr, tier, groupName }) => ({ slug, priceIdr, tier, groupName }))).toEqual([
      { slug: "cute-cipi", priceIdr: 10_000, tier: 1, groupName: "vip" },
      { slug: "pop-cipi", priceIdr: 30_000, tier: 2, groupName: "mvp" },
      { slug: "milk-cipi", priceIdr: 60_000, tier: 3, groupName: "elite" },
      { slug: "star-cipi", priceIdr: 100_000, tier: 4, groupName: "legend" },
    ]);
  });

  it("mempertahankan urutan Cute, Pop, Milk, Star walau sort_order database terbalik", () => {
    const staleRows = [
      { slug: "star-cipi", name: "Star Cipi", sortOrder: 1 },
      { slug: "milk-cipi", name: "Milk Cipi", sortOrder: 2 },
      { slug: "pop-cipi", name: "Pop Cipi", sortOrder: 3 },
      { slug: "cute-cipi", name: "Cute Cipi", sortOrder: 4 },
    ];
    expect(sortCipiRanks(staleRows).map((rank) => rank.slug)).toEqual([
      "cute-cipi",
      "pop-cipi",
      "milk-cipi",
      "star-cipi",
    ]);
  });

  it("memuat fitur yang diberikan untuk setiap rank", () => {
    const bySlug = new Map(CIPI_RANKS.map((rank) => [rank.slug, rank]));
    expect(bySlug.get("cute-cipi")?.perks).toEqual([
      "Prefix ✧CUTE CIPI✧",
      "Limit auction 10",
      "Multiple sethome VIP",
      "3 AxVaults",
      "/feed dan /heal",
      "Kit VIP, Void, dan Cipi Basic",
      "Bypass cooldown BetterRTP",
    ]);
    expect(bySlug.get("pop-cipi")?.perks).toEqual([
      "Semua fitur Cute Cipi",
      "Prefix ✧POP CIPI✧",
      "Limit auction 15",
      "Multiple sethome MVP",
      "5 AxVaults",
      "/fly",
      "Kit MVP dan Cipi Basic",
    ]);
    expect(bySlug.get("milk-cipi")?.perks).toEqual([
      "Semua fitur Pop Cipi",
      "Prefix ✧MILK CIPI✧",
      "Limit auction 20",
      "Multiple sethome Elite",
      "7 AxVaults, 6 baris",
      "Kit Elite dan Cipi Pro",
    ]);
    expect(bySlug.get("star-cipi")?.perks).toEqual([
      "Semua fitur Milk Cipi",
      "Prefix ✧STAR CIPI✧",
      "Limit auction 30",
      "Multiple sethome Legend",
      "10 AxVaults + item picker",
      "/god",
      "Kit Legend dan Cipi Pro",
    ]);
  });
});
