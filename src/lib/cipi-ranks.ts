export interface CipiRankDefinition {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  priceIdr: number;
  tier: number;
  accent: string;
  perks: readonly string[];
  groupName: string;
  sortOrder: number;
  artwork: string;
}

/** Katalog rank CipiSMP. Order tiers define the allowed purchase-upgrade path. */
export const CIPI_RANKS: readonly CipiRankDefinition[] = [
  {
    slug: "cute-cipi",
    name: "Cute Cipi",
    tagline: "Rank awal yang manis dengan fitur penting untuk mulai nyaman bermain.",
    description:
      "Cute Cipi adalah rank paling terjangkau. Nikmati prefix ✧CUTE CIPI✧, hingga 10 lelang, 3 AxVaults, /feed dan /heal, serta akses Kit VIP, Void, dan Cipi Basic. Termasuk beberapa home melalui EssentialsX dan bypass cooldown BetterRTP.",
    priceIdr: 10_000,
    tier: 1,
    accent: "cute",
    perks: [
      "Prefix ✧CUTE CIPI✧",
      "Limit auction 10",
      "Multiple sethome VIP",
      "3 AxVaults",
      "/feed dan /heal",
      "Kit VIP, Void, dan Cipi Basic",
      "Bypass cooldown BetterRTP",
    ],
    groupName: "vip",
    sortOrder: 1,
    artwork: "/images/products/cute-cipi.jpg",
  },
  {
    slug: "pop-cipi",
    name: "Pop Cipi",
    tagline: "Lebih banyak ruang, kemudahan, dan akses kit.",
    description:
      "Pop Cipi mencakup seluruh fitur Cute Cipi, lalu menambah prefix ✧POP CIPI✧, limit 15 lelang, 5 AxVaults, lebih banyak home, akses /fly, serta Kit MVP dan Cipi Basic.",
    priceIdr: 30_000,
    tier: 2,
    accent: "pop",
    perks: [
      "Semua fitur Cute Cipi",
      "Prefix ✧POP CIPI✧",
      "Limit auction 15",
      "Multiple sethome MVP",
      "5 AxVaults",
      "/fly",
      "Kit MVP dan Cipi Basic",
    ],
    groupName: "mvp",
    sortOrder: 2,
    artwork: "/images/products/pop-cipi.jpg",
  },
  {
    slug: "milk-cipi",
    name: "Milk Cipi",
    tagline: "Fitur lebih lengkap untuk pemain yang aktif setiap hari.",
    description:
      "Milk Cipi mencakup seluruh fitur Pop Cipi. Rank ini menambahkan prefix ✧MILK CIPI✧, limit 20 lelang, 7 AxVaults dengan 6 baris per vault, serta akses Kit Elite dan Cipi Pro.",
    priceIdr: 60_000,
    tier: 3,
    accent: "milk",
    perks: [
      "Semua fitur Pop Cipi",
      "Prefix ✧MILK CIPI✧",
      "Limit auction 20",
      "Multiple sethome Elite",
      "7 AxVaults, 6 baris",
      "Kit Elite dan Cipi Pro",
    ],
    groupName: "elite",
    sortOrder: 3,
    artwork: "/images/products/milk-cipi.jpg",
  },
  {
    slug: "star-cipi",
    name: "Star Cipi",
    tagline: "Rank tertinggi dengan fitur paling lengkap.",
    description:
      "Star Cipi mencakup seluruh fitur Milk Cipi. Nikmati prefix ✧STAR CIPI✧, limit 30 lelang, 10 AxVaults dengan item picker, akses /god, serta Kit Legend dan Cipi Pro.",
    priceIdr: 100_000,
    tier: 4,
    accent: "star",
    perks: [
      "Semua fitur Milk Cipi",
      "Prefix ✧STAR CIPI✧",
      "Limit auction 30",
      "Multiple sethome Legend",
      "10 AxVaults + item picker",
      "/god",
      "Kit Legend dan Cipi Pro",
    ],
    groupName: "legend",
    sortOrder: 4,
    artwork: "/images/products/star-cipi.jpg",
  },
];

const CIPI_RANK_ORDER = new Map(CIPI_RANKS.map((rank, index) => [rank.slug, index]));

/** Keep the public four-rank lineup stable even when a database has stale sort_order values. */
export function sortCipiRanks<T extends { slug: string; sortOrder: number; name: string }>(ranks: readonly T[]): T[] {
  return [...ranks].sort((left, right) => {
    const leftIndex = CIPI_RANK_ORDER.get(left.slug);
    const rightIndex = CIPI_RANK_ORDER.get(right.slug);
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
  });
}
