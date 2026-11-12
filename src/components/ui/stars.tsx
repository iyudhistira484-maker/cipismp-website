import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Baris bintang sederhana (tanpa state) — aman dipakai di server component. */
export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} dari 5 bintang`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          style={{ width: size, height: size }}
          className={star <= Math.round(value) ? "fill-accent text-accent" : "text-line-strong"}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Ringkas: bintang + angka + jumlah ulasan. */
export function RatingInline({ count, average, size = 12 }: { count: number; average: number; size?: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted-2">
      <Stars value={average} size={size} />
      <span className="tabular-nums text-muted">{average.toFixed(1)}</span>
      <span>({count})</span>
    </span>
  );
}
