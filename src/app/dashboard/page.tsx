import Link from "next/link";
import { ArrowRight, Clock, Gamepad2, Package, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { requireViewer } from "@/server/auth/guard";
import { entitlementsForUser } from "@/server/entitlements";
import { ordersForUser } from "@/server/orders";
import { getActiveSeason } from "@/server/catalog";
import { profilesForUser } from "@/server/minecraft";
import { activeUntilLabel } from "@/lib/seasons";
import { formatDateWIB, formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { RankBadge, ItemArt } from "@/components/art/item-art";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const viewer = await requireViewer("/dashboard");
  const [entitlements, orders, profiles, season] = await Promise.all([
    entitlementsForUser(viewer.user.id),
    ordersForUser(viewer.user.id, 5),
    profilesForUser(viewer.user.id),
    getActiveSeason(),
  ]);

  const active = entitlements.filter((e) => e.active && e.seasonStatus === "ACTIVE");
  const past = entitlements.filter((e) => !e.active || e.seasonStatus === "ENDED");

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Ringkasan</p>
        <h1 className="mt-2 font-display text-h1 text-ink">
          Halo, {viewer.user.displayName ?? viewer.user.username}.
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          {active.length > 0
            ? `Kamu punya ${active.length} item aktif${season ? ` di ${season.name}` : ""}.`
            : "Belum ada rank atau kit aktif. Semua item berlaku sampai akhir season."}
        </p>
      </header>

      <section aria-labelledby="aktif">
        <div className="flex items-baseline justify-between">
          <h2 id="aktif" className="font-display text-h3 text-ink">Item aktif</h2>
          <Link href="/rank" className="text-[12.5px] text-accent hover:underline">Tambah rank</Link>
        </div>
        {active.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon={<Package className="size-5" />}
            title="Belum ada item aktif"
            description="Rank dan kit berlaku sampai akhir season berjalan. Setelah season berganti, semuanya perlu dibeli lagi."
            action={<Link href="/rank" className="text-[13px] text-accent hover:underline">Lihat rank season ini</Link>}
          />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {active.map((item) => (
              <article key={item.id} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
                {item.productType === "RANK" ? (
                  <RankBadge accent={item.accent} label={item.productName.slice(0, 3)} size={46} />
                ) : (
                  <div className="grid size-[46px] shrink-0 place-items-center rounded-md border border-line bg-bg/60">
                    <ItemArt itemKey="bread" className="size-8" title={item.productName} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] text-ink">{item.productName}</h3>
                    <Badge tone={item.source === "COMP" ? "info" : "neutral"} size="sm">
                      {item.source === "COMP" ? "Diberikan" : "Dibeli"}
                    </Badge>
                  </div>
                  <p className="mt-1 flex items-start gap-1.5 text-2xs leading-relaxed text-muted-2">
                    <Clock className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {activeUntilLabel({ name: item.seasonName, endAt: item.seasonEndsAt })}
                  </p>
                  <p className="mt-1 text-2xs text-muted-2">Pemain: {item.playerName ?? "—"}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="pesanan">
        <div className="flex items-baseline justify-between">
          <h2 id="pesanan" className="font-display text-h3 text-ink">Pesanan terbaru</h2>
          <Link href="/dashboard/pesanan" className="text-[12.5px] text-accent hover:underline">Semua pesanan</Link>
        </div>
        {orders.length === 0 ? (
          <EmptyState
            className="mt-3"
            title="Belum ada pesanan"
            description="Riwayat pembelian, kuitansi, dan status pengiriman akan muncul di sini."
          />
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-2/60 text-2xs uppercase tracking-wider text-muted-2">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Order</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Tanggal</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Total</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-line/70">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10.5px] text-ink">{order.orderNumber}</span>
                      <span className="block text-2xs text-muted-2">{order.mcName}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">{formatDateTimeWIB(order.createdAt)}</td>
                    <td className="px-4 py-3 text-ink">{formatRp(order.totalIdr)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={order.status === "DELIVERED" ? "success" : order.status === "PENDING" ? "accent" : "warning"}>
                        {ORDER_STATUS_LABEL[order.status as OrderStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/pesanan/${order.id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                        Detail <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="akun" className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface/60 p-4">
          <div className="flex items-center gap-2">
            <Gamepad2 className="size-4 text-accent" aria-hidden />
            <h2 id="akun" className="text-[14px] text-ink">Akun Minecraft</h2>
          </div>
          {profiles.length === 0 ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
              Belum ada akun terhubung. Hubungkan untuk melihat rank aktif per pemain.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {profiles.map((profile) => (
                <li key={profile.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-ink">{profile.displayName}</span>
                  <Badge tone={profile.verifiedAt ? "success" : "neutral"} size="sm">
                    {profile.verifiedAt ? "Terverifikasi" : "Belum verifikasi"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/minecraft" className="mt-3 inline-block text-[12.5px] text-accent hover:underline">
            Kelola akun Minecraft
          </Link>
        </div>

        <div className="rounded-lg border border-line bg-surface/60 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-success" aria-hidden />
            <h2 className="text-[14px] text-ink">Keamanan</h2>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            {viewer.user.totpEnabledAt
              ? "2FA aktif. Kode 6 digit diminta setiap login."
              : "Aktifkan 2FA untuk menambah lapisan keamanan akun dan saldo riwayat pembelian."}
          </p>
          <Link href="/dashboard/keamanan" className="mt-3 inline-block text-[12.5px] text-accent hover:underline">
            Atur keamanan akun
          </Link>
        </div>
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="riwayat">
          <h2 id="riwayat" className="font-display text-h3 text-ink">Riwayat season lalu</h2>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {past.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]">
                <span className="text-muted">
                  {item.productName} · {item.seasonName}
                </span>
                <span className="text-2xs text-muted-2">Berakhir {formatDateWIB(item.seasonEndsAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
