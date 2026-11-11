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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[22px] tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ title, description, className, children }: { title?: string; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface/50 p-4", className)}>
      {title ? <h2 className="font-display text-[15px] text-ink">{title}</h2> : null}
      {description ? <p className="mt-1 text-2xs leading-relaxed text-muted-2">{description}</p> : null}
      <div className={title || description ? "mt-3" : undefined}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "accent" | "danger" | "success" }) {
  const valueTone = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-surface/50 px-4 py-3.5">
      <p className="text-2xs uppercase tracking-wider text-muted-2">{label}</p>
      <p className={cn("mt-1 font-display text-[20px] tabular-nums", valueTone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-2xs text-muted-2">{hint}</p> : null}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
        <thead className="bg-surface-2/60 text-2xs uppercase tracking-wider text-muted-2">
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
