import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Clock, Download, ExternalLink, Mail, ShieldAlert, Truck } from "lucide-react";
import { getOrderByPublicToken, getOrderDetail } from "@/server/orders";
import { formatDateTimeWIB, formatDateWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { ORDER_STATUS_LABEL, DELIVERY_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { activeUntilLabel } from "@/lib/seasons";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { cancelOrderAction } from "@/app/actions/order";

export const metadata: Metadata = {
  title: "Status pesanan",
  robots: { index: false, follow: false },
};

const STEPS: Array<{ key: OrderStatus; label: string; hint: string }> = [
  { key: "PENDING", label: "Dibuat", hint: "Menunggu pembayaran" },
  { key: "PAID", label: "Dibayar", hint: "Pembayaran terverifikasi" },
  { key: "DELIVERING", label: "Dikirim", hint: "Perintah dijalankan di server" },
  { key: "DELIVERED", label: "Selesai", hint: "Item sudah masuk" },
];

export default async function OrderStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = await getOrderByPublicToken(token);
  if (!base) notFound();
  const detail = await getOrderDetail(base.id);
  if (!detail) notFound();
  const { order, items, payments, deliveries, season } = detail;
  const payment = payments[0];
  const stepIndex = STEPS.findIndex((step) => step.key === order.status);
  const isExceptional = ["EXPIRED", "CANCELLED", "FAILED", "DISPUTED"].includes(order.status);

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Pesanan {order.orderNumber}</p>
          <h1 className="mt-2 font-display text-h1 text-ink">Status pesanan</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <span>Dibuat {formatDateTimeWIB(order.createdAt)} WIB</span>
            <span aria-hidden>·</span>
            <span>Pemain <strong className="font-medium text-ink">{order.mcName}</strong></span>
            <span aria-hidden>·</span>
            <span>{order.edition === "BEDROCK" ? "Bedrock" : "Java"}</span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Badge tone={order.status === "DELIVERED" ? "success" : isExceptional ? "warning" : "accent"}>
            {ORDER_STATUS_LABEL[order.status]}
          </Badge>
          <div className="flex items-center gap-2 text-2xs text-muted-2">
            <span>Simpan tautan ini</span>
            <CopyButton value={`${process.env.APP_URL ?? ""}/pesanan/${order.publicToken}`} label="Salin tautan" />
          </div>
        </div>
      </div>

      {order.status === "PENDING" && payment ? (
        <div className="mt-8 grid gap-4 rounded-lg border border-accent/30 bg-accent/[0.06] p-5 sm:grid-cols-[1.4fr_1fr] sm:items-center">
          <div>
            <h2 className="font-display text-[17px] text-ink">Selesaikan pembayaran</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Bayar sebelum {formatDateTimeWIB(order.expiresAt)} WIB. Pesanan otomatis kedaluwarsa bila
              melewati batas waktu. {payment.payCode ? `Kode pembayaran: ${payment.payCode}.` : ""}
            </p>
            <p className="mt-2 text-2xs text-muted-2">
              Status berubah hanya setelah webhook gateway terverifikasi. Jangan tutup halaman sebelum
              transaksi selesai.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {payment.checkoutUrl ? (
              <a href={payment.checkoutUrl} target="_blank" rel="noreferrer">
                <Button size="lg" className="w-full">
                  Buka pembayaran
                  <ExternalLink className="size-4" aria-hidden />
                </Button>
              </a>
            ) : null}
            <form action={cancelOrderAction}>
              <input type="hidden" name="token" value={order.publicToken} />
              <Button type="submit" variant="ghost" size="sm" className="w-full">
                Batalkan pesanan
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      <ol className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        {STEPS.map((step, index) => {
          const done = !isExceptional && stepIndex >= index;
          const active = !isExceptional && stepIndex === index;
          return (
            <li key={step.key} className="bg-surface p-4">
              <div className="flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className={active ? "size-4 text-accent" : "size-4 text-success"} aria-hidden />
                ) : (
                  <span className="size-4 rounded-full border border-line-strong" aria-hidden />
                )}
                <p className={done ? "text-[13.5px] text-ink" : "text-[13.5px] text-muted-2"}>{step.label}</p>
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-muted-2">{step.hint}</p>
            </li>
          );
        })}
      </ol>

      {isExceptional ? (
        <Alert
          tone={order.status === "DISPUTED" ? "danger" : "warning"}
          className="mt-6"
          title={ORDER_STATUS_LABEL[order.status]}
        >
          {order.status === "EXPIRED"
            ? "Batas pembayaran terlewati. Kalau kamu sudah membayar, kirim bukti ke email bantuan dengan nomor order di atas; pembayaran yang masuk tetap kami proses."
            : order.status === "CANCELLED"
              ? "Pesanan dibatalkan. Tidak ada dana yang ditarik."
              : order.status === "FAILED"
                ? "Pembayaran diterima tetapi pengiriman otomatis gagal. Tim kami akan mengirim ulang — tidak perlu membayar lagi."
                : "Pesanan sedang ditinjau karena ada sengketa pembayaran. Hubungi bantuan bila kamu merasa ini keliru."}
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <h2 className="font-display text-h3 text-ink">Item</h2>
          <div className="mt-4 divide-y divide-line rounded-lg border border-line">
            {items.map((item) => {
              const delivery = deliveries.find((d) => d.orderItemId === item.id);
              return (
                <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div>
                    <p className="text-[14px] text-ink">{item.nameSnapshot}</p>
                    <p className="mt-0.5 text-2xs text-muted-2">
                      {item.type === "RANK" ? "Rank" : "Kit"} · {item.targetName}
                      {item.meta?.upgradeFromName ? ` · upgrade dari ${item.meta.upgradeFromName}` : ""}
                    </p>
                    {delivery ? (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted">
                        <Truck className="size-2.5" aria-hidden />
                        {DELIVERY_STATUS_LABEL[delivery.status] ?? delivery.status}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-[14px] text-ink">{formatRp(item.lineTotalIdr)}</p>
                </div>
              );
            })}
          </div>

          {season ? (
            <p className="mt-3 flex items-start gap-2 text-2xs leading-relaxed text-muted-2">
              <Clock className="mt-0.5 size-3 shrink-0" aria-hidden />
              {activeUntilLabel(season)}
            </p>
          ) : null}

          <div className="mt-6 rounded-lg border border-line p-4 text-[12.5px] leading-relaxed text-muted">
            <p className="font-medium text-ink">Item belum masuk?</p>
            <p className="mt-1">
              Tunggu beberapa menit — bila kamu offline, item dikirim otomatis saat login berikutnya.
              Kalau status sudah <em>Selesai</em> tetapi item tetap tidak ada, hubungi bantuan dengan
              nomor order di atas. Solusinya pengiriman ulang, bukan pembayaran baru.
            </p>
            <a
              href={`mailto:bantuan@cipismp.my.id?subject=${encodeURIComponent(`Bantuan order ${order.orderNumber}`)}`}
              className="mt-2 inline-flex items-center gap-1.5 text-accent hover:underline"
            >
              <Mail className="size-3.5" aria-hidden />
              Email bantuan
            </a>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <h2 className="font-display text-[16px] text-ink">Ringkasan</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="text-ink">{formatRp(order.subtotalIdr)}</dd></div>
              {order.discountIdr > 0 ? (
                <div className="flex justify-between text-success"><dt>Diskon</dt><dd>−{formatRp(order.discountIdr)}</dd></div>
              ) : null}
              {order.taxIdr > 0 ? (
                <div className="flex justify-between"><dt className="text-muted">Pajak</dt><dd className="text-ink">{formatRp(order.taxIdr)}</dd></div>
              ) : null}
              {order.feeIdr > 0 ? (
                <div className="flex justify-between"><dt className="text-muted">Biaya</dt><dd className="text-ink">{formatRp(order.feeIdr)}</dd></div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-2 text-[15px]">
                <dt className="text-ink">Total</dt>
                <dd className="font-medium text-ink">{formatRp(order.totalIdr)}</dd>
              </div>
            </dl>

            <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-2xs text-muted-2">
              <div className="flex justify-between"><dt>Email</dt><dd className="text-muted">{order.email}</dd></div>
              <div className="flex justify-between"><dt>Gateway</dt><dd className="text-muted">{payment?.provider ?? "—"}</dd></div>
              <div className="flex justify-between"><dt>Season</dt><dd className="text-muted">{season?.name ?? "—"}</dd></div>
              {order.paidAt ? (
                <div className="flex justify-between"><dt>Dibayar</dt><dd className="text-muted">{formatDateTimeWIB(order.paidAt)}</dd></div>
              ) : null}
              {order.deliveredAt ? (
                <div className="flex justify-between"><dt>Selesai</dt><dd className="text-muted">{formatDateWIB(order.deliveredAt)}</dd></div>
              ) : null}
            </dl>

            <a href={`/pesanan/${order.publicToken}/invoice`} className="mt-4 block">
              <Button variant="secondary" className="w-full">
                <Download className="size-4" aria-hidden />
                Unduh kuitansi (PDF)
              </Button>
            </a>
          </div>

          <div className="rounded-lg border border-line bg-surface/50 p-4 text-[12px] leading-relaxed text-muted-2">
            <p className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              Semua pembelian bersifat final. Karena itu kami menampilkan masa aktif, isi item, dan total
              sebelum pembayaran.
            </p>
            <Link href="/legal/syarat-penjualan" className="mt-2 inline-block text-accent hover:underline">
              Baca syarat penjualan
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
