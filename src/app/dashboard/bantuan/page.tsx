import Link from "next/link";
import { ArrowRight, LifeBuoy, MessageCircle, PenLine, ShieldCheck } from "lucide-react";
import { requireCustomer } from "@/server/auth/guard";
import { customerTickets, supportOrderForUser } from "@/server/support";
import { ordersForUser } from "@/server/orders";
import { formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { CreateSupportForm } from "@/components/dashboard/support-forms";
import { Pagination } from "@/components/dashboard/pagination";

export const metadata = { title: "Bantuan", robots: { index: false, follow: false } };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ order?: string; cursor?: string }> }) {
  const viewer = await requireCustomer("/dashboard/bantuan");
  const params = await searchParams;
  const [tickets, recentOrders, selected] = await Promise.all([
    customerTickets(viewer.user.id, params.cursor), ordersForUser(viewer.user.id, 100),
    typeof params.order === "string" && params.order.length <= 128 ? supportOrderForUser(viewer.user.id, params.order) : null,
  ]);
  const orders = recentOrders.map(({ id, orderNumber }) => ({ id, orderNumber }));
  if (selected && !orders.some((order) => order.id === selected.id)) orders.unshift(selected);
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[22px] border border-[#eedee8] bg-gradient-to-br from-[#fff3f8] via-[#fffafd] to-[#f1edf9] p-6 sm:p-8"><div className="pointer-events-none absolute -right-16 -top-24 size-56 rounded-full bg-white/50" aria-hidden /><div className="relative max-w-xl"><p className="eyebrow">Bantuan pemain</p><h1 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-tight text-ink">Kami siap membantu<span className="text-accent">.</span></h1><p className="mt-3 text-[13px] leading-relaxed text-muted">Kirim pertanyaan atau ceritakan kendalamu, lalu pantau balasan tim di satu tempat.</p></div></header>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="new-request" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f9eaf2] text-accent-strong"><PenLine className="size-5" aria-hidden /></span><div><p className="dashboard-kicker">KIRIM PESAN</p><h2 id="new-request" className="mt-1 font-display text-[20px] text-ink">Permintaan baru</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">Pilihan menampilkan 100 pesanan terbaru. Untuk pesanan lebih lama, buka detail pesanannya dan pilih bantuan.</p></div></div><div className="mt-5 border-t border-line pt-5"><CreateSupportForm orders={orders} selectedOrder={selected?.id} /></div></section>
        <div className="space-y-4"><section aria-labelledby="help-history" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="dashboard-kicker">PESANMU</p><h2 id="help-history" className="mt-1 font-display text-[20px] text-ink">Riwayat bantuan</h2><p className="mt-1 text-[12px] text-muted">Pantau percakapan dan balasan tim.</p></div><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2ecfa] text-[#8963a1]"><MessageCircle className="size-5" aria-hidden /></span></div>{tickets.items.length ? <ul className="dashboard-scroll mt-5 max-h-[36rem] space-y-2 overflow-y-auto" tabIndex={0} aria-label="Riwayat bantuan">{tickets.items.map((ticket) => <li key={ticket.id}><Link href={`/dashboard/bantuan/${ticket.id}`} className="group flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-[#fdfafd] p-4 hover:border-accent/40"><span className="min-w-0"><span className="block break-words text-[13px] font-semibold text-ink">{ticket.subject}</span><span className="mt-1 block text-[11px] leading-relaxed text-muted-2">{ticket.orderNumber ?? "Pertanyaan umum"} · {formatDateTimeWIB(ticket.updatedAt)} WIB</span></span><span className="flex items-center gap-2"><Badge tone={ticket.status === "OPEN" ? "accent" : "neutral"}>{ticket.status === "OPEN" ? "Terbuka" : "Ditutup"}</Badge><ArrowRight className="size-4 text-muted-2 group-hover:text-accent" aria-hidden /></span></Link></li>)}</ul> : <div className="mt-5 rounded-2xl border border-dashed border-[#ead8e3] bg-[#fdf9fc] p-5"><LifeBuoy className="size-5 text-accent-strong" aria-hidden /><p className="mt-3 text-[13px] font-semibold text-ink">{params.cursor ? "Tidak ada permintaan di halaman ini." : "Belum ada permintaan bantuan."}</p><p className="mt-1 text-[12px] leading-relaxed text-muted">{params.cursor ? <Link href="/dashboard/bantuan" className="font-semibold text-accent-strong hover:underline">Lihat yang terbaru</Link> : "Pesan dan balasanmu akan muncul di sini."}</p></div>}<Pagination path="/dashboard/bantuan" parameter="cursor" previous={tickets.previous} next={tickets.next} preserve={{ order: selected?.id }} label="Halaman riwayat bantuan" /></section><div className="flex items-start gap-3 rounded-[20px] border border-[#ebdce9] bg-[#f9f4f9] p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden /><p className="text-[12px] leading-relaxed text-muted">Jaga akunmu: jangan bagikan password, kode 2FA, atau data pembayaran rahasia di percakapan.</p></div></div>
      </div>
    </div>
  );
}
