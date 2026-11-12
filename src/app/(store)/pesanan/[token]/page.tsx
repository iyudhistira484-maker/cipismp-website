import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Download, ExternalLink, LifeBuoy, Package, RefreshCw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { getOrderByPublicToken, getOrderDetail } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { getViewer } from "@/server/auth/guard";
import { formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { ORDER_STATUS_LABEL, DELIVERY_STATUS_LABEL } from "@/lib/order-state";
import { orderTrackingMessage, deliveryTrackingMessage } from "@/lib/order-tracking";
import { activeUntilLabel } from "@/lib/seasons";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { OrderTimeline } from "@/components/store/order-timeline";

export const metadata: Metadata = { title: "Status pesanan", robots: { index: false, follow: false } };

export default async function OrderStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = await getOrderByPublicToken(token);
  if (!base) notFound();
  const [detail, settings, viewer] = await Promise.all([getOrderDetail(base.id), getSettings(), getViewer()]);
  if (!detail) notFound();
  const { order, items, payments, deliveries, season } = detail;
  const payment = payments[0];
  const tracking = orderTrackingMessage(order.status, payment?.status);
  const isExceptional = ["EXPIRED", "CANCELLED", "FAILED", "DISPUTED"].includes(order.status) || (order.status === "PENDING" && payment?.status === "UNDERPAID");
  const supportLink = `mailto:${settings.site.supportEmail}?subject=${encodeURIComponent(`Bantuan pesanan ${order.orderNumber}`)}`;

  return (
    <div className="container-page space-y-6 py-8 lg:py-12">
      <header className="relative isolate overflow-hidden rounded-[24px] bg-[#493342] px-6 py-8 text-white shadow-[0_18px_45px_-28px_rgba(69,35,55,.6)] sm:px-9 sm:py-10">
        <div className="absolute inset-0 -z-10 bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#2f1c2c]/95 via-[#4d3044]/90 to-[#4a3042]/65" aria-hidden />
        <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.17em] text-[#ffe0ee]"><Sparkles className="size-3" aria-hidden /> YOUR ORDER JOURNEY</p>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h1 className="font-display text-[clamp(2rem,4vw,2.9rem)] leading-[1.1] tracking-[-.04em]">Status pesanan<span className="text-[#f6b6d1]">.</span></h1><p className="mt-3 break-all font-mono text-[12px] text-white/80">{order.orderNumber}</p><p className="mt-2 text-[12px] leading-relaxed text-white/75">{order.mcName} · {order.edition === "BEDROCK" ? "Bedrock" : "Java"} · Dibuat {formatDateTimeWIB(order.createdAt)} WIB</p></div><span className="rounded-full bg-white"><Badge tone={order.status === "DELIVERED" ? "success" : isExceptional ? "warning" : "accent"}>{isExceptional && order.status === "PENDING" ? "Perlu pemeriksaan" : ORDER_STATUS_LABEL[order.status]}</Badge></span></div>
      </header>

      <section aria-labelledby="order-current" className={`rounded-[22px] border p-5 sm:p-6 ${isExceptional ? "border-[#ebd7bb] bg-[#fffaf2]" : "border-[#eadbe5] bg-white shadow-card"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-2xl"><p className="dashboard-kicker">STATUS SAAT INI</p><h2 id="order-current" className="mt-1 font-display text-[21px] text-ink">{tracking.title}</h2><p className="mt-2 text-[13px] leading-relaxed text-muted">{tracking.body}</p>{order.status === "PENDING" && payment?.status !== "UNDERPAID" ? <p className="mt-2 text-[12px] text-muted">Batas pembayaran: <strong className="font-semibold text-ink">{formatDateTimeWIB(order.expiresAt)} WIB</strong>{payment?.payCode ? <> · Kode: <span className="break-all font-mono text-ink">{payment.payCode}</span></> : null}</p> : null}{order.status === "PENDING" && !payment ? <p className="mt-2 text-[12px] text-warning">Instruksi pembayaran belum tersedia. Hubungi bantuan jika diperlukan.</p> : null}</div><a href={`/pesanan/${order.publicToken}`} className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3.5 py-2.5 text-[12px] font-semibold text-ink hover:border-accent/40 hover:text-accent-strong"><RefreshCw className="size-3.5" aria-hidden /> Perbarui status</a></div>
        <div className="mt-4 flex flex-wrap items-center gap-3">{order.status === "PENDING" && payment?.status !== "UNDERPAID" && payment?.checkoutUrl ? <a href={payment.checkoutUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white hover:bg-accent-strong">Buka pembayaran <ExternalLink className="size-3.5" aria-hidden /></a> : null}{order.status === "PENDING" && payment && payment.status !== "UNDERPAID" && (!order.userId || viewer?.user.id === order.userId) ? <form action="/api/orders/cancel" method="post"><input type="hidden" name="token" value={order.publicToken} /><Button type="submit" variant="ghost" size="sm">Batalkan pesanan</Button></form> : null}{tracking.needsHelp ? <a href={supportLink} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-strong hover:underline"><LifeBuoy className="size-3.5" aria-hidden /> Hubungi bantuan</a> : null}</div>
      </section>

      <OrderTimeline status={order.status} paymentStatus={payment?.status} paidAt={order.paidAt} deliveredAt={order.deliveredAt} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,.8fr)]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="order-items" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6"><p className="dashboard-kicker">YOUR ITEMS</p><h2 id="order-items" className="mt-1 font-display text-[21px] text-ink">Isi pesanan<span className="text-accent">.</span></h2>{items.length === 0 ? <p className="mt-4 text-[12px] text-muted">Belum ada rincian item.</p> : <ul className="mt-4 space-y-2.5">{items.map((item) => { const delivery = deliveries.find((d) => d.orderItemId === item.id); return <li key={item.id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-[#f0e5ec] bg-[#fdfafd] p-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f8eaf2] text-accent"><Package className="size-4" aria-hidden /></span><div className="min-w-0 flex-1"><h3 className="break-words text-[13px] font-semibold text-ink">{item.nameSnapshot}</h3><p className="mt-1 break-words text-[11px] text-muted">{item.type === "RANK" ? "Rank" : "Kit"} · {item.targetName}{item.meta?.upgradeFromName ? ` · upgrade dari ${item.meta.upgradeFromName}` : ""}{item.meta?.giftFromName ? ` · hadiah dari ${item.meta.giftFromName}` : ""}</p>{delivery ? <><p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10px] text-muted"><Truck className="size-3" aria-hidden />{DELIVERY_STATUS_LABEL[delivery.status] ?? "Status belum tersedia"}</p><p className="mt-1.5 text-[11px] leading-relaxed text-muted-2">{deliveryTrackingMessage(delivery.status)}</p></> : null}</div><p className="text-[13px] font-semibold text-ink">{formatRp(item.lineTotalIdr)}</p></li>; })}</ul>}{season ? <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted"><CalendarDays className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />{activeUntilLabel(season)}</p> : null}</section>
          <section className="rounded-[22px] border border-[#e9dce9] bg-[#f9f4f9] p-5 sm:p-6"><div className="flex gap-3"><LifeBuoy className="mt-0.5 size-5 shrink-0 text-[#8d6a99]" aria-hidden /><div><h2 className="font-display text-[16px] text-ink">Akses atau reward belum terlihat?</h2><p className="mt-2 text-[12px] leading-relaxed text-muted">Pengiriman dapat menunggu pemain login atau server tersedia. Login melalui LoginSecurity terlebih dahulu. Untuk kit CipiPrime dan Cipi++, akses PlayerKits dikirim ke server; reward diklaim di dalam game. Jika masih bermasalah, hubungi bantuan dengan nomor pesanan. Jangan membayar lagi tanpa arahan.</p><a href={supportLink} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Email bantuan →</a></div></div></section>
        </div>
        <aside className="min-w-0 space-y-4"><section className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6"><p className="dashboard-kicker">ORDER SUMMARY</p><h2 className="mt-1 font-display text-[21px] text-ink">Ringkasan<span className="text-accent">.</span></h2><dl className="mt-4 space-y-2.5 text-[12px]"><div className="flex justify-between gap-3"><dt className="text-muted">Subtotal</dt><dd className="text-ink">{formatRp(order.subtotalIdr)}</dd></div>{order.discountIdr > 0 ? <div className="flex justify-between gap-3 text-success"><dt>Diskon {order.couponCode ? `(${order.couponCode})` : order.discountLabel ? `(otomatis: ${order.discountLabel})` : ""}</dt><dd>−{formatRp(order.discountIdr)}</dd></div> : null}{order.taxIdr > 0 ? <div className="flex justify-between gap-3"><dt className="text-muted">Pajak</dt><dd>{formatRp(order.taxIdr)}</dd></div> : null}{order.feeIdr > 0 ? <div className="flex justify-between gap-3"><dt className="text-muted">Biaya</dt><dd>{formatRp(order.feeIdr)}</dd></div> : null}<div className="flex justify-between gap-3 border-t border-line pt-3 text-[15px] font-semibold text-ink"><dt>Total</dt><dd>{formatRp(order.totalIdr)}</dd></div></dl><dl className="mt-4 space-y-2 border-t border-line pt-4 text-[11px]"><div className="flex justify-between gap-3"><dt className="text-muted-2">Email</dt><dd className="min-w-0 break-all text-right text-muted">{order.email}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-2">Gateway</dt><dd className="text-muted">{payment?.provider ?? "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-2">Season</dt><dd className="text-muted">{season?.name ?? "—"}</dd></div></dl><a href={`/pesanan/${order.publicToken}/invoice`} className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-[#fcf8fb] px-4 text-[12px] font-semibold text-ink hover:border-accent/40 hover:text-accent-strong"><Download className="size-4" aria-hidden /> Unduh kuitansi (PDF)</a></section>
          <section className="rounded-[20px] border border-line bg-white p-5 text-[11px] leading-relaxed text-muted"><div className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#8d6a99]" aria-hidden /><p>Link status ini dapat membuka rincian pesanan. Simpan dengan aman dan jangan bagikan sembarangan.</p></div><CopyButton value={`${process.env.APP_URL ?? ""}/pesanan/${order.publicToken}`} label="Salin tautan" compact className="mt-3" /><p className="mt-4 border-t border-line pt-3">Pembelian bersifat final. <Link href="/legal/syarat-penjualan" className="font-semibold text-accent-strong hover:underline">Baca syarat penjualan →</Link></p></section>
        </aside>
      </div>
    </div>
  );
}
