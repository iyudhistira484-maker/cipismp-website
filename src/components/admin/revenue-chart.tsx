import { formatRp } from "@/lib/money";
import { formatDateWIB } from "@/lib/dates";
import type { RevenuePoint } from "@/server/admin/queries";

/**
 * Grafik batang pendapatan harian tanpa dependensi chart. Dibaca sebagai satu gambar
 * dengan ringkasan teks, plus tabel data yang bisa dibuka untuk angka tepatnya.
 */
export function RevenueChart({ points }: { points: RevenuePoint[] }) {
  const max = Math.max(...points.map((point) => point.revenueIdr), 1);
  const total = points.reduce((sum, point) => sum + point.revenueIdr, 0);
  const busiest = points.reduce<RevenuePoint | undefined>(
    (best, point) => (!best || point.revenueIdr > best.revenueIdr ? point : best),
    undefined,
  );
  const width = 720;
  const height = 160;
  const barWidth = width / Math.max(points.length, 1);
  const summary = `Pendapatan ${points.length} hari terakhir: ${formatRp(total)}, tertinggi ${formatRp(busiest?.revenueIdr ?? 0)} pada ${busiest ? formatDateWIB(new Date(`${busiest.day}T00:00:00+07:00`)) : "—"}.`;

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">Pendapatan harian (WIB, order dibayar)</span>
        <span className="font-display text-[16px] tabular-nums text-ink">{formatRp(total)}</span>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height + 18}`}
        className="mt-2 h-40 w-full"
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
      >
        <line x1={0} y1={height} x2={width} y2={height} stroke="currentColor" className="text-line" strokeWidth={1} />
        {points.map((point, index) => {
          const barHeight = point.revenueIdr === 0 ? 1 : Math.max(2, Math.round((point.revenueIdr / max) * (height - 12)));
          const x = index * barWidth + barWidth * 0.18;
          const barW = Math.max(barWidth * 0.64, 1);
          return (
            <g key={point.day}>
              <rect
                x={x}
                y={height - barHeight}
                width={barW}
                height={barHeight}
                rx={1.5}
                className={point.revenueIdr > 0 ? "fill-accent/80" : "fill-line"}
              />
              <title>{`${point.day}: ${formatRp(point.revenueIdr)} dari ${point.orders} order`}</title>
            </g>
          );
        })}
        {points.length > 0 ? (
          <>
            <text x={0} y={height + 14} className="fill-muted-2 text-[9px]">
              {points[0]!.day}
            </text>
            <text x={width} y={height + 14} textAnchor="end" className="fill-muted-2 text-[9px]">
              {points[points.length - 1]!.day}
            </text>
          </>
        ) : null}
      </svg>

      <details className="mt-2 text-2xs text-muted-2">
        <summary className="cursor-pointer select-none hover:text-accent">Lihat angka per hari</summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="text-muted-2">
              <tr>
                <th scope="col" className="py-1 font-medium">Tanggal</th>
                <th scope="col" className="py-1 text-right font-medium">Order</th>
                <th scope="col" className="py-1 text-right font-medium">Pendapatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {[...points].reverse().map((point) => (
                <tr key={point.day}>
                  <td className="py-1">{point.day}</td>
                  <td className="py-1 text-right tabular-nums">{point.orders}</td>
                  <td className="py-1 text-right tabular-nums text-ink">{formatRp(point.revenueIdr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
