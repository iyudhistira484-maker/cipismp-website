import ITEM_ICON_IDS from "@/lib/minecraft-item-icon-ids.json";

const ICON_IDS = new Set<string>(ITEM_ICON_IDS);
const ITEM_ICON_ALIASES: Record<string, string> = {
  bed: "red_bed",
  boat: "oak_boat",
};
const FALLBACK_ICON_ID = "barrier";

/** Return a self-hosted vanilla inventory icon for the given Minecraft item key. */
export function getMinecraftItemIcon(itemKey: string): string {
  const normalized = itemKey.trim().toLowerCase().replace(/^minecraft:/, "");
  const candidate = ITEM_ICON_ALIASES[normalized] ?? normalized;
  const iconId = /^[a-z0-9_]+$/.test(candidate) && ICON_IDS.has(candidate) ? candidate : FALLBACK_ICON_ID;

  return `/images/minecraft/26.3/items/${iconId}.png`;
}
