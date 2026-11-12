import Link from "next/link";
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
  return <div className="space-y-7"><header><p className="eyebrow">Bantuan pemain</p><h1 className="mt-2 font-display text-h1 text-ink">Pusat bantuan</h1><p className="mt-2 text-[14px] leading-relaxed text-muted">Kirim pertanyaan dan pantau balasan tim di sini. Jangan bagikan kata sandi atau kode 2FA.</p></header>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><section className="rounded-xl border border-line bg-white p-5 shadow-card"><h2 className="font-display text-h3 text-ink">Permintaan baru</h2><p className="mt-2 text-[12px] text-muted">Pilihan menampilkan 100 pesanan terbaru. Untuk pesanan lebih lama, buka detail pesanannya dan pilih bantuan.</p><div className="mt-4"><CreateSupportForm orders={orders} selectedOrder={selected?.id} /></div></section>
    <section><div className="flex items-baseline justify-between gap-3"><h2 className="font-display text-h3 text-ink">Riwayat bantuan</h2><span className="text-[11px] text-muted-2">20 per halaman</span></div>{tickets.items.length ? <ul className="dashboard-scroll mt-3 max-h-[36rem] overflow-y-auto rounded-lg border border-line bg-white" tabIndex={0} aria-label="Riwayat bantuan">{tickets.items.map((ticket) => <li key={ticket.id} className="border-b border-line last:border-0"><Link href={`/dashboard/bantuan/${ticket.id}`} className="flex flex-wrap justify-between gap-3 p-4 hover:bg-surface-2/60"><span><span className="block text-[13px] font-semibold text-ink">{ticket.subject}</span><span className="mt-1 block text-[11px] text-muted-2">{ticket.orderNumber ?? "Pertanyaan umum"} · {formatDateTimeWIB(ticket.updatedAt)} WIB</span></span><Badge tone={ticket.status === "OPEN" ? "accent" : "neutral"}>{ticket.status === "OPEN" ? "Terbuka" : "Ditutup"}</Badge></Link></li>)}</ul> : <p className="mt-3 rounded-lg border border-dashed border-line p-5 text-[13px] text-muted">{params.cursor ? <>Tidak ada permintaan di halaman ini. <Link href="/dashboard/bantuan" className="text-accent-strong hover:underline">Lihat yang terbaru</Link>.</> : "Belum ada permintaan bantuan."}</p>}<Pagination path="/dashboard/bantuan" parameter="cursor" previous={tickets.previous} next={tickets.next} preserve={{ order: selected?.id }} label="Halaman riwayat bantuan" /></section></div>
  </div>;
}
