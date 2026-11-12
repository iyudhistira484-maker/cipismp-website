/** Minecraft inventory art is served from local vanilla-derived PNG assets. */
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getMinecraftItemIcon } from "@/lib/minecraft-item-icons";

/** Pixel-accurate inventory icon rendered from the local Minecraft asset snapshot. */
export function ItemArt({ itemKey, className, title }: { itemKey: string; className?: string; title?: string }) {
  return (
    <span className={cn("relative inline-flex size-10 shrink-0 items-center justify-center", className)}>
      <Image
        src={getMinecraftItemIcon(itemKey)}
        alt={title ?? itemKey}
        fill
        sizes="40px"
        unoptimized
        className="minecraft-item-icon object-contain"
      />
    </span>
  );
}

const TIER_COLORS: Record<string, { base: string; edge: string; ink: string }> = {
  star: { base: "#f1c5dc", edge: "#b9437f", ink: "#482039" },
  milk: { base: "#fff8fc", edge: "#c79ab2", ink: "#51394a" },
  pop: { base: "#df8db5", edge: "#a63771", ink: "#421b31" },
  cute: { base: "#d5c3ed", edge: "#8061a6", ink: "#332641" },
  iron: { base: "#e6e3e8", edge: "#89838e", ink: "#39353e" },
  gold: { base: "#f0ddbc", edge: "#9a6d2b", ink: "#47300f" },
  diamond: { base: "#d2e9e7", edge: "#4d8986", ink: "#173e3c" },
  amber: { base: "#edc5db", edge: "#b9437f", ink: "#482039" },
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
      <svg viewBox="0 0 64 64" className="size-full drop-shadow-[0_3px_8px_rgba(96,32,71,0.18)]">
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
        className="absolute inset-x-0 bottom-[18%] text-center font-mono text-[9px] uppercase tracking-wider"
        style={{ color: palette.ink }}
      >
        {label}
      </span>
    </div>
  );
}

/** Logo resmi CipiSMP dari pemilik server, dipakai sebagai identitas toko. */
export function Logo({ className, showMark = true }: { className?: string; showMark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {showMark ? (
        <Image
          src="/images/cipismp-logo.jpeg"
          alt=""
          width={56}
          height={56}
          sizes="56px"
          className="size-12 shrink-0 rounded-xl border border-line bg-white object-contain p-0.5"
        />
      ) : null}
      <span className="flex flex-col justify-center">
        <span className="font-display text-[17px] font-semibold leading-none tracking-[-0.03em] text-ink">
          CipiSMP
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-accent-strong">
          Toko resmi
        </span>
      </span>
    </span>
  );
}
