import { describe, expect, it } from "vitest";
import { CIPI_KITS } from "@/lib/cipi-kits";

describe("katalog kit CipiSMP", () => {
  const prime = CIPI_KITS[0]!;
  const plusPlus = CIPI_KITS[1]!;

  it("menampilkan hanya dua kit, dengan harga, batas pembelian, dan permission yang ditetapkan", () => {
    expect(CIPI_KITS.map(({ name, priceIdr }) => [name, priceIdr])).toEqual([
      ["CipiPrime", 35_000],
      ["Cipi++", 75_000],
    ]);
    expect(CIPI_KITS.map((kit) => kit.maxPerSeason)).toEqual([1, 1]);
    expect(CIPI_KITS.map((kit) => kit.purchaseCooldownHours)).toEqual([0, 0]);
    expect(CIPI_KITS.map((kit) => kit.permissionNode)).toEqual([
      "playerkits.kits.cipiprime",
      "playerkits.kits.cipi++",
    ]);
    expect(CIPI_KITS.every((kit) => kit.description.includes("cooldown 5 jam"))).toBe(true);
  });

  it("menyimpan reward CipiPrime persis seperti yang diminta", () => {
    expect(prime.items.map(({ itemKey, quantity, enchantments = [] }) => [itemKey, quantity, [...enchantments]])).toEqual([
      ["diamond_sword", 1, ["Sharpness III", "Unbreaking III"]],
      ["diamond_pickaxe", 1, ["Efficiency IV", "Unbreaking III"]],
      ["diamond_axe", 1, ["Efficiency IV", "Unbreaking III"]],
      ["diamond_shovel", 1, ["Efficiency IV", "Unbreaking III"]],
      ["cooked_beef", 64, []],
      ["golden_carrot", 64, []],
      ["diamond_helmet", 1, ["Protection III", "Unbreaking III"]],
      ["diamond_chestplate", 1, ["Protection III", "Unbreaking III"]],
      ["diamond_leggings", 1, ["Protection III", "Unbreaking III"]],
      ["diamond_boots", 1, ["Protection III", "Unbreaking III"]],
      ["ender_pearl", 16, []],
      ["golden_apple", 4, []],
    ]);
  });

  it("menyimpan reward Cipi++ persis seperti yang diminta", () => {
    expect(plusPlus.items.map(({ itemKey, quantity, enchantments = [] }) => [itemKey, quantity, [...enchantments]])).toEqual([
      ["netherite_sword", 1, ["Sharpness IV", "Unbreaking III"]],
      ["netherite_pickaxe", 1, ["Efficiency V", "Unbreaking III"]],
      ["diamond_axe", 1, ["Efficiency V", "Unbreaking III"]],
      ["diamond_shovel", 1, ["Efficiency V", "Unbreaking III"]],
      ["cooked_beef", 64, []],
      ["golden_carrot", 64, []],
      ["netherite_helmet", 1, ["Protection IV", "Unbreaking III"]],
      ["netherite_chestplate", 1, ["Protection IV", "Unbreaking III"]],
      ["netherite_leggings", 1, ["Protection IV", "Unbreaking III"]],
      ["netherite_boots", 1, ["Protection IV", "Unbreaking III"]],
      ["ender_pearl", 32, []],
      ["golden_apple", 8, []],
      ["totem_of_undying", 1, []],
    ]);
  });
});
