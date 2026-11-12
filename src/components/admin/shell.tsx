import * as React from "react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="relative mb-6 overflow-hidden rounded-[22px] border border-[#eddee8] bg-gradient-to-br from-[#fff3f8] via-[#fffafd] to-[#f1edf9] p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-14 -top-24 size-48 rounded-full bg-white/50" aria-hidden />
      <div className="relative flex flex-wrap items-end justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-accent-strong">CipiSMP / Admin</p><h1 className="mt-2 break-words font-display text-[clamp(1.65rem,3vw,2.35rem)] leading-tight tracking-[-.025em] text-ink">{title}<span className="text-accent">.</span></h1>{description ? <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p> : null}</div>{actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}</div>
    </header>
  );
}

export function Card({ title, description, className, children }: { title?: string; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6", className)}>
      {title ? <h2 className="font-display text-[17px] font-semibold text-ink">{title}</h2> : null}
      {description ? <p className="mt-1 text-[12px] leading-relaxed text-muted">{description}</p> : null}
      <div className={title || description ? "mt-4" : undefined}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "accent" | "danger" | "success" }) {
  const valueTone = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : tone === "accent" ? "text-accent-strong" : "text-ink";
  return (
    <div className="min-w-0 rounded-[20px] border border-line bg-white px-5 py-5 shadow-card">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className={cn("mt-3 break-words font-display text-[clamp(1.3rem,2vw,1.65rem)] font-semibold tracking-tight tabular-nums", valueTone)}>{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-muted-2">{hint}</p> : null}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="dashboard-scroll min-w-0 max-h-[36rem] overflow-auto rounded-[16px] border border-line bg-white" tabIndex={0} role="region" aria-label="Tabel data, gulir untuk melihat semua kolom dan baris">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-[#faf4f8] text-2xs uppercase tracking-wider text-muted-2"><tr>{head.map((cell) => <th key={cell} scope="col" className="px-4 py-3 font-semibold">{cell}</th>)}</tr></thead>
        <tbody className="divide-y divide-line/70">{empty ? <tr><td colSpan={head.length} className="px-4 py-7 text-center text-muted-2">Belum ada data.</td></tr> : children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle text-muted", className)}>{children}</td>;
}
