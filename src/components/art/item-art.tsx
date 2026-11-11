/**
 * Art original CipiSMP Store — digambar sendiri sebagai SVG grid 12×12.
 * Tidak ada tekstur Minecraft yang disalin; lihat docs/ASSETS.md untuk lisensi.
 */
import { cn } from "@/lib/utils";

type Sprite = { palette: Record<string, string>; rows: string[] };

/** Palet bersama: batu, kayu, besi, emas, kain. */
const STONE = "#9a9a9f";
const STONE_D = "#6c6c72";
const STONE_L = "#b9b9be";
const WOOD = "#a9773f";
const WOOD_D = "#7a5228";
const WOOD_L = "#c69558";
const IRON = "#d6d9de";
const IRON_D = "#9aa0a8";
const GOLD = "#e7b95c";

const SPRITES: Record<string, Sprite> = {
  stone_sword: {
    palette: { b: STONE_L, s: STONE, d: STONE_D, g: WOOD_D, h: WOOD },
    rows: [
      ".........bb.",
      "........bsb.",
      ".......bsbd.",
      "......bsbd..",
      ".....bsbd...",
      "....bsbd....",
      "...bsbd.....",
      "..bsbd......",
      ".hgsbd......",
      ".ghsd.......",
      "..hh........",
      "..hh........",
    ],
  },
  iron_pickaxe: {
    palette: { b: IRON, s: IRON_D, d: "#6f747c", h: WOOD, g: WOOD_D },
    rows: [
      "...bbbbbb...",
      "..bssssssb..",
      ".bs....g.sb.",
      "bb.....g..bb",
      "......gg....",
      ".....gg.....",
      "....gg......",
      "...gg.......",
      "..gg........",
      ".gg.........",
      ".g..........",
      "............",
    ],
  },
  stone_pickaxe: {
    palette: { b: STONE_L, s: STONE, d: STONE_D, h: WOOD, g: WOOD_D },
    rows: [
      "...bbbbbb...",
      "..bssssssb..",
      ".bs....g.sb.",
      "bb.....g..bb",
      "......gg....",
      ".....gg.....",
      "....gg......",
      "...gg.......",
      "..gg........",
      ".gg.........",
      ".g..........",
      "............",
    ],
  },
  stone_axe: {
    palette: { b: STONE_L, s: STONE, d: STONE_D, h: WOOD, g: WOOD_D },
    rows: [
      ".....bbb....",
      "....bsssd...",
      "...bsssd....",
      "...bssd.....",
      "....bgd.....",
      "....gg......",
      "...gg.......",
      "..gg........",
      ".gg.........",
      ".g..........",
      "............",
      "............",
    ],
  },
  bread: {
    palette: { b: "#c98b4b", s: "#a96f37", l: "#e0a869", d: "#7d4f24" },
    rows: [
      "............",
      "...bbbbb....",
      "..blllllb...",
      ".bllllsllb..",
      ".blslllslb..",
      "blllsllsllb.",
      "blsllsllllb.",
      ".bsllllllb..",
      "..bsssssb...",
      "...ddddd....",
      "............",
      "............",
    ],
  },
  cooked_beef: {
    palette: { b: "#8d4b3a", s: "#6f3628", l: "#b06a52", w: "#efe4d4" },
    rows: [
      "............",
      "...bbbb.....",
      "..bllllb....",
      ".blllsslb...",
      ".bllsssllb..",
      "bllsssslwlb.",
      "bllssssswwb.",
      ".bllssswwb..",
      "..bllbbwb...",
      "...bbbb.....",
      "............",
      "............",
    ],
  },
  torch: {
    palette: { f: "#ffd166", y: "#f4a63a", o: "#d97b2b", w: WOOD, d: WOOD_D },
    rows: [
      "............",
      "....ff......",
      "...fyyf.....",
      "...fyof.....",
      "....oo......",
      "....ww......",
      "....wd......",
      "....wd......",
      "....wd......",
      "....wd......",
      "....wd......",
      "............",
    ],
  },
  bed: {
    palette: { w: WOOD, d: WOOD_D, r: "#b8463f", s: "#8e332e", p: "#efe6d8", l: "#d4574f" },
    rows: [
      "............",
      "............",
      "..wwwwwwww..",
      ".wpprrrrrrw.",
      ".wplrrrrrrw.",
      ".wddddddddw.",
      ".wwwwwwwwww.",
      ".wwwwwwwwww.",
      ".wwwwwwwwww.",
      "............",
      "............",
      "............",
    ],
  },
  map: {
    palette: { p: "#e8dcc0", s: "#c9b68d", d: "#8f7d59", x: "#a53f37" },
    rows: [
      "............",
      ".pppppppppp.",
      ".pssssssssp.",
      ".psppppsspp.",
      ".pspxxppspp.",
      ".pspxpppspp.",
      ".pspppssssp.",
      ".pssssssssp.",
      ".pppppppppp.",
      "............",
      "............",
      "............",
    ],
  },
  compass: {
    palette: { r: "#c9a227", s: "#8f741c", w: "#e8e2d2", n: "#c1443b", d: "#2f2a22" },
    rows: [
      "....rrrr....",
      "..rrssssrr..",
      ".rssssssssr.",
      ".rsdddddddr.",
      ".rsddnndddr.",
      ".rsdnnnnddr.",
      ".rsddnndddr.",
      ".rsdddddddr.",
      ".rssssssssr.",
      "..rrssssrr..",
      "....rrrr....",
      "............",
    ],
  },
  boat: {
    palette: { w: WOOD_L, d: WOOD_D, s: "#5c3d1e" },
    rows: [
      "............",
      "............",
      ".w........w.",
      ".ww......ww.",
      "..wwwwwwww..",
      "..wddddddw..",
      "...dddddd...",
      "...dssssd...",
      "....ssss....",
      "............",
      "............",
      "............",
    ],
  },
  saddle: {
    palette: { b: "#8a5a2b", d: "#5d3a17", l: "#b07a3f", m: "#c9c9c9" },
    rows: [
      "............",
      "............",
      "...bbbb.....",
      "..bllllb....",
      "..bllllbb...",
      ".bbddddbbb..",
      "bbd....dbb..",
      "bd......db..",
      "b........b..",
      "............",
      "............",
      "............",
    ],
  },
  lantern: {
    palette: { m: "#6b6f76", l: "#c9ccd2", f: "#ffd166", o: "#d9902b" },
    rows: [
      ".....mm.....",
      "....mllm....",
      "....m..m....",
      "...mllllm...",
      "...mlfflm...",
      "...mlfflm...",
      "...mloolm...",
      "...mllllm...",
      "....mmmm....",
      "............",
      "............",
      "............",
    ],
  },
  scaffolding: {
    palette: { w: WOOD, d: WOOD_D, l: WOOD_L },
    rows: [
      "............",
      "wlw......wlw",
      "w.w......w.w",
      "w..w....w..w",
      "w...w..w...w",
      "w....ww....w",
      "wlw......wlw",
      "w.w......w.w",
      "w..w....w..w",
      "w...w..w...w",
      "w....ww....w",
      "............",
    ],
  },
  ladder: {
    palette: { w: WOOD, d: WOOD_D },
    rows: [
      "............",
      "..w......w..",
      "..wwwwwwww..",
      "..w......w..",
      "..w......w..",
      "..wwwwwwww..",
      "..w......w..",
      "..w......w..",
      "..wwwwwwww..",
      "..w......w..",
      "..w......w..",
      "............",
    ],
  },
  ender_chest: {
    palette: { d: "#1d2a2b", m: "#2f4446", l: "#3f5f60", e: "#8fe3c8" },
    rows: [
      "............",
      "..dddddddd..",
      ".dlllllllld.",
      ".dlllllllld.",
      ".dddddddddd.",
      ".dmmmeemmmd.",
      ".dmmmeemmmd.",
      ".dmmmmmmmmd.",
      ".dddddddddd.",
      "............",
      "............",
      "............",
    ],
  },
  __fallback: {
    palette: { b: STONE_L, s: STONE, d: STONE_D },
    rows: [
      "...bbbbbb...",
      "..bssssssb..",
      ".bssssssssb.",
      ".bsssssssdb.",
      ".bsssssssdb.",
      ".bsssssssdb.",
      ".bsssssssdb.",
      ".bsssssssdb.",
      ".bsssssssdb.",
      "..bssssssb..",
      "...dddddd...",
      "............",
    ],
  },
};

/** Blok dirender sebagai kubus isometrik agar terasa seperti barang in-game. */
const BLOCKS: Record<string, { top: string; left: string; right: string; pattern?: "planks" | "brick" | "smooth" | "glass" | "log" }> = {
  oak_planks: { top: "#c69558", left: "#a9773f", right: "#8c5f30", pattern: "planks" },
  oak_log: { top: "#b98d55", left: "#8a6135", right: "#6f4c28", pattern: "log" },
  stone_bricks: { top: "#a3a3a8", left: "#85858b", right: "#6e6e74", pattern: "brick" },
  smooth_stone: { top: "#b6b6bb", left: "#9a9a9f", right: "#808086", pattern: "smooth" },
  glass: { top: "#bfd9dd", left: "#9dc2c8", right: "#7fa6ac", pattern: "glass" },
};

export function isBlockItem(itemKey: string): boolean {
  return itemKey in BLOCKS;
}

export function SpriteArt({
  itemKey,
  className,
  title,
}: {
  itemKey: string;
  className?: string;
  title?: string;
}) {
  const sprite = SPRITES[itemKey] ?? SPRITES.__fallback!;
  const cells: Array<{ x: number; y: number; fill: string; key: string }> = [];
  sprite.rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char === "." || char === " ") return;
      const fill = sprite.palette[char];
      if (!fill) return;
      cells.push({ x, y, fill, key: `${x}-${y}` });
    });
  });
  return (
    <svg
      viewBox="0 0 12 12"
      className={cn("size-10", className)}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? itemKey}
    >
      {cells.map((cell) => (
        <rect key={cell.key} x={cell.x} y={cell.y} width={1} height={1} fill={cell.fill} />
      ))}
    </svg>
  );
}

function BlockArt({ itemKey, className, title }: { itemKey: string; className?: string; title?: string }) {
  const block = BLOCKS[itemKey]!;
  return (
    <svg viewBox="0 0 32 32" className={cn("size-10", className)} role="img" aria-label={title ?? itemKey}>
      {/* sisi atas */}
      <path d="M16 3 L29 10 L16 17 L3 10 Z" fill={block.top} />
      {/* sisi kiri */}
      <path d="M3 10 L16 17 L16 29 L3 22 Z" fill={block.left} />
      {/* sisi kanan */}
      <path d="M29 10 L16 17 L16 29 L29 22 Z" fill={block.right} />
      {block.pattern === "planks" ? (
        <g opacity="0.35" stroke="#5c3d1e" strokeWidth="0.7">
          <path d="M3 14 L16 21 M3 18 L16 25 M8 7 L21 14 M13 4 L26 11" fill="none" />
        </g>
      ) : null}
      {block.pattern === "brick" ? (
        <g opacity="0.4" stroke="#4c4c52" strokeWidth="0.7" fill="none">
          <path d="M7 12 L10 13.5 M12 10 L15 11.5 M19 13 L23 15 M7 17 L10 18.5 M12 20 L15 21.5 M19 18 L23 20" />
        </g>
      ) : null}
      {block.pattern === "glass" ? (
        <g opacity="0.55" fill="#eef7f8">
          <path d="M7 9 L11 11 L11 13 L7 11 Z" opacity="0.5" />
          <path d="M20 12 L24 10 L24 12 L20 14 Z" opacity="0.35" />
        </g>
      ) : null}
      {block.pattern === "log" ? (
        <g opacity="0.4" stroke="#4e3418" strokeWidth="0.7">
          <path d="M3 13 L16 20 M3 17 L16 24" fill="none" />
        </g>
      ) : null}
      <path d="M16 17 L16 29" stroke="#000" strokeOpacity="0.18" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

export function ItemArt({ itemKey, className, title }: { itemKey: string; className?: string; title?: string }) {
  if (isBlockItem(itemKey)) return <BlockArt itemKey={itemKey} className={className} title={title} />;
  return <SpriteArt itemKey={itemKey} className={className} title={title} />;
}

const TIER_COLORS: Record<string, { base: string; edge: string; ink: string }> = {
  star: { base: "#f6cf5f", edge: "#b07b1c", ink: "#241a06" },
  milk: { base: "#e5f1ed", edge: "#6eaaa0", ink: "#19302d" },
  pop: { base: "#ff987c", edge: "#bc4c44", ink: "#31110f" },
  cute: { base: "#ef9ad6", edge: "#99518f", ink: "#311026" },
  iron: { base: "#b9bcc2", edge: "#6f747c", ink: "#1b1c1e" },
  gold: { base: "#e7b95c", edge: "#9a7423", ink: "#241a06" },
  diamond: { base: "#7fd8d0", edge: "#2f7f7a", ink: "#07201f" },
  amber: { base: "#e0a84e", edge: "#8f6520", ink: "#1a1409" },
};

/** Badge rank: bentuk perisai dengan puncak bertingkat, seperti lencana koleksi. */
export function RankBadge({
  accent = "amber",
  label,
  className,
  size = 64,
}: {
  accent?: string;
  label: string;
  className?: string;
  size?: number;
}) {
  const palette = TIER_COLORS[accent] ?? TIER_COLORS.amber!;
  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 64 64" className="size-full drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]">
        <defs>
          <linearGradient id={`badge-${accent}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={palette.base} stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.edge} />
          </linearGradient>
        </defs>
        <path
          d="M32 3 L56 12 V32 C56 45 45 55 32 61 C19 55 8 45 8 32 V12 Z"
          fill={`url(#badge-${accent})`}
          stroke={palette.edge}
          strokeWidth="1.5"
        />
        <path
          d="M32 9 L50 16 V32 C50 42 42 50 32 55 C22 50 14 42 14 32 V16 Z"
          fill="none"
          stroke={palette.ink}
          strokeOpacity="0.28"
          strokeWidth="1"
        />
        <g opacity="0.75">
          <rect x="28" y="17" width="8" height="2" fill={palette.ink} />
          <rect x="27" y="21" width="10" height="2" fill={palette.ink} opacity="0.85" />
          <rect x="28" y="25" width="8" height="2" fill={palette.ink} opacity="0.7" />
        </g>
      </svg>
      <span
        className="absolute inset-x-0 bottom-[18%] text-center font-pixel text-[9px] uppercase tracking-wider"
        style={{ color: palette.ink }}
      >
        {label}
      </span>
    </div>
  );
}

/** Logo CipiSMP: wordmark + aksen piksel kecil (hanya di logo). */
export function Logo({ className, showMark = true }: { className?: string; showMark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {showMark ? (
        <svg viewBox="0 0 24 24" className="size-7 shrink-0" aria-hidden>
          <rect x="2" y="2" width="7" height="7" rx="1" fill="#e0a84e" />
          <rect x="11" y="2" width="7" height="7" rx="1" fill="#e0a84e" opacity="0.55" />
          <rect x="2" y="11" width="7" height="7" rx="1" fill="#e0a84e" opacity="0.55" />
          <rect x="11" y="11" width="7" height="7" rx="1" fill="#e0a84e" opacity="0.22" />
          <rect x="17" y="17" width="5" height="5" rx="1" fill="#e0a84e" />
        </svg>
      ) : null}
      <span className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
        Cipi<span className="text-accent">SMP</span>
      </span>
    </span>
  );
}
