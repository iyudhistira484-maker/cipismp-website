export interface CipiKitDefinition {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  priceIdr: number;
  sortOrder: number;
  maxPerSeason: number;
  /** Store-side repeat-purchase delay; PlayerKits enforces the in-game claim cooldown. */
  purchaseCooldownHours: number;
  permissionNode: string;
  perks: readonly string[];
  items: readonly {
    itemKey: string;
    name: string;
    quantity: number;
    enchantments?: readonly string[];
    lore?: readonly string[];
  }[];
}

/**
 * Default CipiSMP kit catalogue. Access is purchased once per season; the five-hour
 * in-game claim cooldown is configured separately in PlayerKits on the Minecraft server.
 */
export const CIPI_KITS: readonly CipiKitDefinition[] = [
  {
    slug: "cipiprime",
    name: "CipiPrime",
    tagline: "Akses kit Diamond lewat PlayerKits selama satu season.",
    description:
      "Pembelian mengaktifkan akses CipiPrime di PlayerKits sampai season berakhir. Klaim kit dapat diulang dengan cooldown 5 jam yang diatur di server.",
    priceIdr: 35_000,
    sortOrder: 1,
    maxPerSeason: 1,
    purchaseCooldownHours: 0,
    permissionNode: "playerkits.kits.cipiprime",
    perks: [
      "Akses PlayerKits sampai season berakhir",
      "Cooldown klaim 5 jam diatur oleh PlayerKits",
      "Dibeli sekali per pemain setiap season",
    ],
    items: [
      { itemKey: "diamond_sword", name: "Diamond Sword", quantity: 1, enchantments: ["Sharpness III", "Unbreaking III"] },
      { itemKey: "diamond_pickaxe", name: "Diamond Pickaxe", quantity: 1, enchantments: ["Efficiency IV", "Unbreaking III"] },
      { itemKey: "diamond_axe", name: "Diamond Axe", quantity: 1, enchantments: ["Efficiency IV", "Unbreaking III"] },
      { itemKey: "diamond_shovel", name: "Diamond Shovel", quantity: 1, enchantments: ["Efficiency IV", "Unbreaking III"] },
      { itemKey: "cooked_beef", name: "Cooked Beef", quantity: 64 },
      { itemKey: "golden_carrot", name: "Golden Carrot", quantity: 64 },
      { itemKey: "diamond_helmet", name: "Diamond Helmet", quantity: 1, enchantments: ["Protection III", "Unbreaking III"] },
      { itemKey: "diamond_chestplate", name: "Diamond Chestplate", quantity: 1, enchantments: ["Protection III", "Unbreaking III"] },
      { itemKey: "diamond_leggings", name: "Diamond Leggings", quantity: 1, enchantments: ["Protection III", "Unbreaking III"] },
      { itemKey: "diamond_boots", name: "Diamond Boots", quantity: 1, enchantments: ["Protection III", "Unbreaking III"] },
      { itemKey: "ender_pearl", name: "Ender Pearl", quantity: 16 },
      { itemKey: "golden_apple", name: "Golden Apple", quantity: 4 },
    ],
  },
  {
    slug: "cipi-plus-plus",
    name: "Cipi++",
    tagline: "Akses kit Netherite lewat PlayerKits selama satu season.",
    description:
      "Pembelian mengaktifkan akses Cipi++ di PlayerKits sampai season berakhir. Klaim kit dapat diulang dengan cooldown 5 jam yang diatur di server.",
    priceIdr: 75_000,
    sortOrder: 2,
    maxPerSeason: 1,
    purchaseCooldownHours: 0,
    permissionNode: "playerkits.kits.cipi++",
    perks: [
      "Akses PlayerKits sampai season berakhir",
      "Cooldown klaim 5 jam diatur oleh PlayerKits",
      "Dibeli sekali per pemain setiap season",
    ],
    items: [
      { itemKey: "netherite_sword", name: "Netherite Sword", quantity: 1, enchantments: ["Sharpness IV", "Unbreaking III"] },
      { itemKey: "netherite_pickaxe", name: "Netherite Pickaxe", quantity: 1, enchantments: ["Efficiency V", "Unbreaking III"] },
      { itemKey: "diamond_axe", name: "Diamond Axe", quantity: 1, enchantments: ["Efficiency V", "Unbreaking III"] },
      { itemKey: "diamond_shovel", name: "Diamond Shovel", quantity: 1, enchantments: ["Efficiency V", "Unbreaking III"] },
      { itemKey: "cooked_beef", name: "Cooked Beef", quantity: 64 },
      { itemKey: "golden_carrot", name: "Golden Carrot", quantity: 64 },
      { itemKey: "netherite_helmet", name: "Netherite Helmet", quantity: 1, enchantments: ["Protection IV", "Unbreaking III"] },
      { itemKey: "netherite_chestplate", name: "Netherite Chestplate", quantity: 1, enchantments: ["Protection IV", "Unbreaking III"] },
      { itemKey: "netherite_leggings", name: "Netherite Leggings", quantity: 1, enchantments: ["Protection IV", "Unbreaking III"] },
      { itemKey: "netherite_boots", name: "Netherite Boots", quantity: 1, enchantments: ["Protection IV", "Unbreaking III"] },
      { itemKey: "ender_pearl", name: "Ender Pearl", quantity: 32 },
      { itemKey: "golden_apple", name: "Golden Apple", quantity: 8 },
      { itemKey: "totem_of_undying", name: "Totem of Undying", quantity: 1 },
    ],
  },
];
