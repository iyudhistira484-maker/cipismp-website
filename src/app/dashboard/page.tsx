import Link from "next/link";
import { ArrowRight, Clock, Gamepad2, Package, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { requireCustomer } from "@/server/auth/guard";
import { entitlementsForUser } from "@/server/entitlements";
import { ordersForUser } from "@/server/orders";
import { getActiveSeason } from "@/server/catalog";
import { profilesForUser } from "@/server/minecraft";
import { notificationPreferences } from "@/server/auth/notification-preferences";
import { activeUntilLabel } from "@/lib/seasons";
import { formatDateWIB, formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { RankBadge, ItemArt } from "@/components/art/item-art";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const viewer = await requireCustomer("/dashboard");
  const [entitlements, orders, profiles, season, preferences] = await Promise.all([
    entitlementsForUser(viewer.user.id),
    ordersForUser(viewer.user.id, 5),
    profilesForUser(viewer.user.id),
    getActiveSeason(),
    notificationPreferences(viewer.user.id),
  ]);

  const active = entitlements.filter((e) => e.active && e.seasonStatus === "ACTIVE");
  const past = entitlements.filter((e) => !e.active || e.seasonStatus === "ENDED");
  const actions = [
    ...(!viewer.user.emailVerifiedAt ? [{ href: "/verifikasi-email", title: "Verifikasi email", description: "Aktifkan email agar checkout dengan akun bisa digunakan." }] : []),
    ...(profiles.some((profile) => profile.verifiedAt) ? [] : [{ href: "/dashboard/minecraft", title: "Hubungkan akun Minecraft", description: "Verifikasi in-game untuk melihat item milik pemainmu." }]),
    ...(!viewer.user.totpEnabledAt ? [{ href: "/dashboard/keamanan", title: "Amankan akun dengan 2FA", description: "Tambahkan perlindungan ekstra untuk akun toko." }] : []),
    ...(orders.some((order) => order.status === "PENDING") ? [{ href: "/dashboard/pesanan", title: "Periksa pesanan menunggu", description: "Lihat status pembayaran pada pesanan terbarumu." }] : []),
  ];

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-xl border border-line bg-white px-6 py-7 shadow-card sm:px-8 sm:py-8">
        <div className="absolute inset-y-0 right-0 hidden w-40 border-l border-line/60 bg-surface-2/60 sm:block" aria-hidden />
        <div className="relative">
          <p className="eyebrow">Akun CipiSMP / Ringkasan</p>
          <h1 className="mt-3 max-w-xl font-display text-[clamp(1.8rem,4vw,2.6rem)] leading-tight text-ink">Halo, {viewer.user.displayName ?? viewer.user.username}.</h1>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">Semua yang kamu perlukan untuk memantau item dan aktivitas akun, di satu tempat.</p>
          <Link href="/dashboard/profil" className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-strong hover:underline">Kelola profil <ArrowRight className="size-3.5" /></Link>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4 shadow-card"><p className="text-[11px] text-muted">Item aktif</p><p className="mt-2 font-display text-[23px] font-semibold text-ink">{active.length}</p><p className="mt-1 text-2xs text-muted-2">Rank & kit</p></div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-card"><p className="text-[11px] text-muted">Akun terhubung</p><p className="mt-2 font-display text-[23px] font-semibold text-ink">{profiles.filter((profile) => profile.verifiedAt).length}</p><p className="mt-1 text-2xs text-muted-2">Minecraft terverifikasi</p></div>
        <div className="col-span-2 rounded-xl border border-line bg-white p-4 shadow-card sm:col-span-1"><p className="text-[11px] text-muted">Season aktif</p><p className="mt-2 font-display text-[18px] font-semibold text-ink">{season?.name ?? "Belum ada"}</p><p className="mt-1 text-2xs text-muted-2">{season ? `Berakhir ${formatDateWIB(season.endAt)}` : "Pantau pengumuman berikutnya"}</p></div>
      </div>

      {preferences?.dashboardOrderUpdates && orders[0] ? <Link href={`/dashboard/pesanan/${orders[0].id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/20 bg-white p-4 hover:border-accent/40"><span><span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-2">Pembaruan pesanan terbaru</span><span className="mt-1 block text-[13px] font-semibold text-ink">{ORDER_STATUS_LABEL[orders[0].status]} · {orders[0].orderNumber}</span></span><span className="text-[12px] font-semibold text-accent-strong">Lihat status →</span></Link> : null}

      {actions.length > 0 ? (
        <section aria-labelledby="langkah-akun">
          <div className="flex items-baseline justify-between gap-3"><h2 id="langkah-akun" className="font-display text-h3 text-ink">Langkah berikutnya</h2><span className="text-2xs text-muted-2">Sesuai kondisi akunmu</span></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {actions.map((action) => (
              <Link key={action.title} href={action.href} className="group flex items-center justify-between gap-4 rounded-lg border border-line bg-white p-4 transition-colors hover:border-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                <span><span className="block text-[13px] font-semibold text-ink">{action.title}</span><span className="mt-1 block text-[12px] leading-relaxed text-muted">{action.description}</span></span>
                <ArrowRight className="size-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="aktif">
        <div className="flex items-baseline justify-between">
          <h2 id="aktif" className="font-display text-h3 text-ink">Item aktif</h2>
          <Link href="/dashboard/item" className="text-[12.5px] text-accent hover:underline">Lihat rank & kit</Link>
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
          <div className="dashboard-scroll mt-3 max-h-[28rem] overflow-auto rounded-lg border border-line bg-white" tabIndex={0} role="region" aria-label="Pesanan terbaru, gulir untuk melihat tabel">
            <table className="w-full min-w-[510px] text-left text-[13px]">
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
              : "Aktifkan 2FA untuk menambah lapisan keamanan akun dan riwayat pembelian."}
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
