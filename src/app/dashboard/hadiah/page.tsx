import Link from "next/link";
import { requireCustomer } from "@/server/auth/guard";
import { giftsReceivedByUser, giftsSentByUser } from "@/server/gifts";
import { ORDER_STATUS_LABEL } from "@/lib/order-state";
import { formatDateTimeWIB } from "@/lib/dates";
import { Pagination } from "@/components/dashboard/pagination";
import { decodeCursor } from "@/server/pagination";

export const metadata = { title: "Hadiah", robots: { index: false, follow: false } };

export default async function GiftsPage({ searchParams }: { searchParams: Promise<{ sent?: string; received?: string }> }) {
  const viewer = await requireCustomer("/dashboard/hadiah");
  const params = await searchParams;
  const [sent, received] = await Promise.all([giftsSentByUser(viewer.user.id, params.sent), giftsReceivedByUser(viewer.user.id, params.received)]);
  const preserve = { sent: decodeCursor(params.sent) ? params.sent : undefined, received: decodeCursor(params.received) ? params.received : undefined };
  return <div className="space-y-7"><header><p className="eyebrow">Akun pemain</p><h1 className="mt-2 font-display text-h1 text-ink">Riwayat hadiah</h1><p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">Hadiah terkirim berasal dari pesanan akunmu. Hadiah diterima hanya muncul untuk Minecraft yang sudah diverifikasi.</p></header>
    <div className="grid items-start gap-5 xl:grid-cols-2"><section><h2 className="font-display text-h3 text-ink">Dikirim</h2>{sent.items.length ? <ul className="dashboard-scroll mt-3 max-h-96 overflow-y-auto rounded-lg border border-line bg-white" tabIndex={0} aria-label="Hadiah dikirim">{sent.items.map((gift) => <li key={gift.id} className="border-b border-line last:border-0"><Link href={`/dashboard/pesanan/${gift.orderId}`} className="block p-4 hover:bg-surface-2/60"><p className="text-[13px] font-semibold text-ink">{gift.name} → {gift.player}</p><p className="mt-1 text-[11px] text-muted-2">{gift.seasonName} · {ORDER_STATUS_LABEL[gift.status]} · {formatDateTimeWIB(gift.createdAt)} WIB</p><p className="mt-1 text-[11px] text-accent-strong">Lihat pesanan →</p></Link></li>)}</ul> : <p className="mt-3 rounded-lg border border-dashed border-line p-5 text-[13px] text-muted">{params.sent ? <>Tidak ada hadiah di halaman ini. <Link href="/dashboard/hadiah" className="text-accent-strong hover:underline">Lihat yang terbaru</Link>.</> : "Belum ada hadiah yang dikirim."}</p>}<Pagination path="/dashboard/hadiah" parameter="sent" previous={sent.previous} next={sent.next} preserve={preserve} label="Halaman hadiah dikirim" /></section>
    <section><h2 className="font-display text-h3 text-ink">Diterima</h2>{received.items.length ? <ul className="dashboard-scroll mt-3 max-h-96 overflow-y-auto rounded-lg border border-line bg-white" tabIndex={0} aria-label="Hadiah diterima">{received.items.map((gift) => <li key={gift.id} className="border-b border-line p-4 last:border-0"><p className="text-[13px] font-semibold text-ink">{gift.name} untuk {gift.player}</p><p className="mt-1 text-[11px] text-muted-2">Dari {gift.sender} · {gift.seasonName} · {ORDER_STATUS_LABEL[gift.status]}</p></li>)}</ul> : <p className="mt-3 rounded-lg border border-dashed border-line p-5 text-[13px] text-muted">{params.received ? <>Tidak ada hadiah di halaman ini. <Link href="/dashboard/hadiah" className="text-accent-strong hover:underline">Lihat yang terbaru</Link>.</> : <>Belum ada hadiah diterima yang tercatat. <Link href="/dashboard/minecraft" className="text-accent-strong hover:underline">Verifikasi Minecraft</Link> untuk melihatnya.</>}</p>}<Pagination path="/dashboard/hadiah" parameter="received" previous={received.previous} next={received.next} preserve={preserve} label="Halaman hadiah diterima" /><p className="mt-2 text-[11px] leading-relaxed text-muted-2">Status adalah catatan toko; akses tetap perlu diperiksa di game. Kuitansi hanya tersedia bagi pembeli.</p></section></div><p className="text-[11px] text-muted-2">20 hadiah per halaman.</p>
  </div>;
}
