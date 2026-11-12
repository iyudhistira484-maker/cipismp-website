import { AlertCircle, Check, Circle, Clock3 } from "lucide-react";
import type { OrderStatus } from "@/lib/order-state";
import { orderTimeline, type TimelineState } from "@/lib/order-timeline";
import { formatDateTimeWIB } from "@/lib/dates";

const stateLabel: Record<TimelineState, string> = { complete: "Tahap terlewati", current: "Tahap saat ini", attention: "Perlu perhatian", upcoming: "Belum sampai tahap ini" };

export function OrderTimeline(props: { status: OrderStatus; paymentStatus?: string | null; paidAt?: Date | null; deliveredAt?: Date | null }) {
  const steps = orderTimeline(props);
  return <section aria-labelledby="order-timeline-heading" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-7"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="dashboard-kicker">YOUR ORDER JOURNEY</p><h2 id="order-timeline-heading" className="mt-1 font-display text-[23px] text-ink">Perjalanan pesanan<span className="text-accent">.</span></h2></div><p className="text-[11px] text-muted">Berdasarkan catatan toko saat ini</p></div><ol className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{steps.map((step, index) => {
    const active = step.state === "current";
    const attention = step.state === "attention";
    const complete = step.state === "complete";
    return <li key={step.key} aria-current={active || attention ? "step" : undefined} className={`min-w-0 rounded-2xl border p-4 ${attention ? "border-[#e9d3b5] bg-[#fffaf1]" : active ? "border-[#e5b9d1] bg-[#fdf3f8]" : complete ? "border-[#d7e7dc] bg-[#f6fbf7]" : "border-line bg-[#fcfafb]"}`}><div className="flex items-center justify-between gap-2"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${attention ? "bg-[#f7e9d1] text-warning" : active ? "bg-[#f4dce9] text-accent-strong" : complete ? "bg-[#e2f0e6] text-success" : "bg-[#f2edf0] text-muted-2"}`}>{attention ? <AlertCircle className="size-4" aria-hidden /> : complete ? <Check className="size-4" aria-hidden /> : active ? <Clock3 className="size-4" aria-hidden /> : <Circle className="size-3" aria-hidden />}</span><span className="font-mono text-[10px] text-muted-2">0{index + 1}</span></div><p className="mt-3 text-[13px] font-semibold leading-snug text-ink">{step.label}</p><p className={`mt-1 text-[10px] font-semibold ${attention ? "text-warning" : active ? "text-accent-strong" : complete ? "text-success" : "text-muted-2"}`}>{props.status === "DISPUTED" && step.key === "done" && step.date ? "Catatan sebelumnya" : stateLabel[step.state]}</p><p className="mt-2 text-[11px] leading-relaxed text-muted">{step.hint}</p>{step.date ? <p className="mt-2 text-[10px] leading-relaxed text-muted-2">Catatan: {formatDateTimeWIB(step.date)} WIB</p> : null}</li>;
  })}</ol><p className="mt-5 text-[11px] leading-relaxed text-muted-2">Status mengikuti catatan toko, bukan pemeriksaan langsung inventaris atau akses di game.</p></section>;
}
