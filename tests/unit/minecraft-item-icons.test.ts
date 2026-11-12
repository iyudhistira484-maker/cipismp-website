import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ITEM_ICON_IDS from "@/lib/minecraft-item-icon-ids.json";
import { CIPI_KITS } from "@/lib/cipi-kits";
import { getMinecraftItemIcon } from "@/lib/minecraft-item-icons";

const ICON_DIRECTORY = resolve(process.cwd(), "public/images/minecraft/26.3/items");

describe("sprite item Minecraft", () => {
  it("menyediakan aset PNG lokal untuk semua sprite yang dibundel", () => {
    expect(ITEM_ICON_IDS.length).toBeGreaterThan(20);
    expect(new Set(ITEM_ICON_IDS).size).toBe(ITEM_ICON_IDS.length);
    for (const id of ITEM_ICON_IDS) {
      expect(existsSync(resolve(ICON_DIRECTORY, `${id}.png`))).toBe(true);
    }
  });

  it("memetakan seluruh item CipiPrime dan Cipi++ ke ikon inventaris Minecraft yang sesuai", () => {
    for (const kit of CIPI_KITS) {
      for (const item of kit.items) {
        expect(getMinecraftItemIcon(item.itemKey)).toBe(`/images/minecraft/26.3/items/${item.itemKey}.png`);
      }
    }
    expect(getMinecraftItemIcon("minecraft:diamond_sword")).toBe("/images/minecraft/26.3/items/diamond_sword.png");
    expect(getMinecraftItemIcon("bed")).toBe("/images/minecraft/26.3/items/red_bed.png");
  });

  it("memakai ikon barrier lokal untuk item yang tidak tersedia", () => {
    expect(getMinecraftItemIcon("custom:missing_item")).toBe("/images/minecraft/26.3/items/barrier.png");
    expect(getMinecraftItemIcon("../../secret")).toBe("/images/minecraft/26.3/items/barrier.png");
    expect(existsSync(resolve(ICON_DIRECTORY, "barrier.png"))).toBe(true);
  });
});
