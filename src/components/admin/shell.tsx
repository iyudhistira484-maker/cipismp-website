import * as React from "react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-accent-strong">CipiSMP / Admin</p>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,3vw,2rem)] leading-tight tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ title, description, className, children }: { title?: string; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-line bg-white p-5 shadow-card", className)}>
      {title ? <h2 className="font-display text-[15px] text-ink">{title}</h2> : null}
      {description ? <p className="mt-1 text-2xs leading-relaxed text-muted-2">{description}</p> : null}
      <div className={title || description ? "mt-3" : undefined}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "accent" | "danger" | "success" }) {
  const valueTone = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-5 shadow-card">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className={cn("mt-3 font-display text-[24px] font-semibold tracking-tight tabular-nums", valueTone)}>{value}</p>
      {hint ? <p className="mt-1.5 text-2xs text-muted-2">{hint}</p> : null}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="dashboard-scroll max-h-[36rem] overflow-auto rounded-lg border border-line bg-white" tabIndex={0} role="region" aria-label="Tabel data, gulir untuk melihat semua kolom dan baris">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-[#fbf6f9] text-2xs uppercase tracking-wider text-muted-2">
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-3 py-2 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-3 py-6 text-center text-muted-2">
                Belum ada data.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 align-middle text-muted", className)}>{children}</td>;
}
