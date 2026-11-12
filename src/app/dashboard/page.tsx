import Link from "next/link";
import { ArrowRight, ArrowUpRight, Boxes, CalendarDays, CheckCircle2, Clock3, Gamepad2, Gift, Package, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { requireCustomer } from "@/server/auth/guard";
import { entitlementsForUser } from "@/server/entitlements";
import { ordersForUser } from "@/server/orders";
import { getActiveSeason } from "@/server/catalog";
import { profilesForUser } from "@/server/minecraft";
import { notificationPreferences } from "@/server/auth/notification-preferences";
import { env } from "@/server/env";
import { activeUntilLabel } from "@/lib/seasons";
import { formatDateWIB, formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-state";
import { Badge } from "@/components/ui/badge";
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

  // A legacy link is not proof of the current offline server identity.
  const verified = profiles.filter((profile) => profile.verifiedAt && (env.MINECRAFT_LOOKUP_MODE !== "offline" || profile.identityVerifiedVersion === 2));
  const verifiedUuids = new Set(verified.map((profile) => profile.uuid.toLowerCase()));
  const visibleItems = entitlements.filter((item) => verifiedUuids.has(item.uuid.toLowerCase()));
  const active = visibleItems.filter((item) => item.active && item.seasonStatus === "ACTIVE");
  const past = visibleItems.filter((item) => !item.active || item.seasonStatus === "ENDED");
  const name = viewer.user.displayName ?? viewer.user.username;
  const actions = [
    ...(!viewer.user.emailVerifiedAt ? [{ href: "/verifikasi-email", title: "Verifikasi email", description: "Aktifkan email untuk checkout dengan akun.", icon: CheckCircle2 }] : []),
    ...(verified.length ? [] : [{ href: "/dashboard/minecraft", title: profiles.length ? "Verifikasi ulang Minecraft" : "Hubungkan Minecraft", description: "Login di server, lalu verifikasi akunmu.", icon: Gamepad2 }]),
    ...(!viewer.user.totpEnabledAt ? [{ href: "/dashboard/keamanan", title: "Amankan akun dengan 2FA", description: "Tambahkan lapisan keamanan untuk akunmu.", icon: ShieldCheck }] : []),
    ...(orders.some((order) => order.status === "PENDING") ? [{ href: "/dashboard/pesanan", title: "Periksa pesanan menunggu", description: "Lihat status pembayaran pesananmu.", icon: Package }] : []),
  ];

  return (
    <div className="space-y-7 sm:space-y-8">
      <header className="relative isolate overflow-hidden rounded-[22px] bg-[#493342] px-6 py-8 text-white shadow-[0_18px_45px_-28px_rgba(69,35,55,.6)] sm:px-9 sm:py-10">
        <div className="absolute inset-0 -z-10 bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#2f1c2c]/95 via-[#4d3044]/90 to-[#4a3042]/55" aria-hidden />
        <div className="relative max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.17em] text-[#ffe0ee] backdrop-blur-sm"><Sparkles className="size-3" aria-hidden /> Player journal</p>
          <h1 className="mt-5 break-words font-display text-[clamp(2rem,4vw,3rem)] leading-[1.1] tracking-[-.045em] text-white">Halo, {name}<span className="text-[#f6b6d1]">.</span></h1>
          <p className="mt-3 max-w-[370px] text-[13.5px] leading-relaxed text-white/80">Selamat datang kembali di sudut kecilmu. Semua cerita dan perjalananmu di CipiSMP ada di sini.</p>
          <Link href="/dashboard/profil" className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Lihat profil <ArrowUpRight className="size-3.5" aria-hidden /></Link>
        </div>
        <div className="absolute bottom-5 right-6 hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-white/70 sm:flex"><span className="h-px w-8 bg-white/50" /> YOUR CIPI STORY</div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Ringkasan akun">
        <div className="rounded-[18px] border border-[#efdee8] bg-white p-4 shadow-card sm:p-5">
          <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-muted">Item aktif</span><span className="grid size-8 place-items-center rounded-xl bg-[#fbebf3] text-accent"><Boxes className="size-4" aria-hidden /></span></div>
          <p className="mt-2 font-display text-[26px] font-semibold leading-none text-ink">{active.length}</p><p className="mt-1.5 text-[11px] text-muted-2">Rank & kit di toko</p>
        </div>
        <div className="rounded-[18px] border border-[#efdee8] bg-white p-4 shadow-card sm:p-5">
          <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-muted">Akun terhubung</span><span className="grid size-8 place-items-center rounded-xl bg-[#f2ecfa] text-[#8c69ab]"><Gamepad2 className="size-4" aria-hidden /></span></div>
          <p className="mt-2 font-display text-[26px] font-semibold leading-none text-ink">{verified.length}</p><p className="mt-1.5 text-[11px] text-muted-2">Minecraft terverifikasi</p>
        </div>
        <div className="col-span-2 rounded-[18px] border border-[#efdee8] bg-white p-4 shadow-card sm:col-span-1 sm:p-5">
          <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-muted">Season</span><span className="grid size-8 place-items-center rounded-xl bg-[#fff3e5] text-[#b78048]"><CalendarDays className="size-4" aria-hidden /></span></div>
          <p className="mt-2 truncate font-display text-[20px] font-semibold leading-tight text-ink">{season?.name ?? "Belum ada"}</p><p className="mt-1 text-[11px] text-muted-2">{season ? `Berakhir ${formatDateWIB(season.endAt)}` : "Nantikan pengumuman"}</p>
        </div>
      </div>

      {preferences?.dashboardOrderUpdates && orders[0] ? (
        <Link href={`/dashboard/pesanan/${orders[0].id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-[#fff5fa] px-5 py-4 transition-colors hover:border-accent/40">
          <span><span className="block text-[10px] font-bold uppercase tracking-[.14em] text-accent-strong">Pembaruan pesanan terbaru</span><span className="mt-1 block text-[13px] font-semibold text-ink">{ORDER_STATUS_LABEL[orders[0].status]} · {orders[0].orderNumber}</span></span><span className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong">Lihat status <ArrowRight className="size-3.5" aria-hidden /></span>
        </Link>
      ) : null}

      {actions.length > 0 ? (
        <section aria-labelledby="langkah-akun">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="dashboard-kicker">A LITTLE HEAD START</p><h2 id="langkah-akun" className="mt-1 font-display text-[21px] text-ink">Langkah berikutnya<span className="text-accent">.</span></h2></div><span className="text-[11px] text-muted-2">Disesuaikan untuk akunmu</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{actions.map((action) => {
            const Icon = action.icon;
            return <Link key={action.title} href={action.href} className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition-colors hover:border-accent/40"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent"><Icon className="size-[18px]" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink">{action.title}</span><span className="mt-1 block text-[11.5px] leading-relaxed text-muted">{action.description}</span></span><ArrowUpRight className="size-4 shrink-0 text-muted-2 transition-colors group-hover:text-accent" aria-hidden /></Link>;
          })}</div>
        </section>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section aria-labelledby="aktif" className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="dashboard-kicker">YOUR COLLECTION</p><h2 id="aktif" className="mt-1 font-display text-[21px] text-ink">Item aktif<span className="text-accent">.</span></h2><p className="mt-1 text-[11.5px] leading-relaxed text-muted">Catatan hak di toko, bukan status langsung di server.</p></div><Link href="/dashboard/item" className="shrink-0 text-[11px] font-semibold text-accent-strong hover:underline">Lihat semua <span aria-hidden>↗</span></Link></div>
          {active.length === 0 ? (
            <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[#e8d5e1] bg-[#fdf8fb] px-4 py-8 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#f7e8f1] text-accent"><Package className="size-5" aria-hidden /></span>
              <h3 className="mt-3 text-[14px] font-semibold text-ink">{verified.length ? "Belum ada item aktif" : "Petualangan dimulai di sini"}</h3>
              <p className="mt-1 max-w-[260px] text-[12px] leading-relaxed text-muted">{verified.length ? "Rank dan kit yang tercatat untuk season ini akan muncul di sini." : "Hubungkan akun Minecraft untuk melihat rank dan kit milikmu."}</p>
              <Link href={verified.length ? "/rank" : "/dashboard/minecraft"} className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-strong hover:underline">{verified.length ? "Jelajahi rank" : "Hubungkan akun"} <ArrowRight className="size-3.5" aria-hidden /></Link>
            </div>
          ) : (
            <div className="mt-5 space-y-2.5">{active.map((item) => (
              <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-[#f0e5ec] bg-[#fdfafd] p-3.5">
                {item.productType === "RANK" ? <RankBadge accent={item.accent} label={item.productName.slice(0, 3)} size={48} /> : <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-white"><ItemArt itemKey="bread" className="size-8" title={item.productName} /></div>}
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-semibold text-ink">{item.productName}</h3><Badge tone={item.source === "COMP" ? "info" : "neutral"} size="sm">{item.source === "COMP" ? "Diberikan" : "Dibeli"}</Badge></div><p className="mt-1 text-[11px] text-muted">Pemain: {item.playerName ?? "—"}</p><p className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-muted-2"><Clock3 className="mt-0.5 size-3 shrink-0" aria-hidden />{activeUntilLabel({ name: item.seasonName, endAt: item.seasonEndsAt })}</p></div>
              </article>
            ))}</div>
          )}
        </section>

        <section aria-labelledby="akun" className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="dashboard-kicker">PLAYER IDENTITY</p><h2 id="akun" className="mt-1 font-display text-[21px] text-ink">Akun Minecraft<span className="text-accent">.</span></h2></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f2ecfa] text-[#8c69ab]"><Gamepad2 className="size-4" aria-hidden /></span></div>
          {profiles.length === 0 ? <p className="mt-4 text-[12px] leading-relaxed text-muted">Belum ada akun terhubung. Verifikasi di dalam game untuk melihat item pemainmu.</p> : <ul className="mt-4 space-y-2">{profiles.map((profile) => {
            const isVerified = verifiedUuids.has(profile.uuid.toLowerCase());
            return <li key={profile.id} className="flex items-center gap-3 rounded-xl bg-[#faf7fa] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f0e4ef] font-display text-sm font-semibold text-accent-strong">{profile.displayName.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-ink">{profile.displayName}</span><span className="block text-[10px] text-muted-2">{profile.edition === "JAVA" ? "Java Edition" : "Bedrock Edition"}</span></span><Badge tone={isVerified ? "success" : "neutral"} size="sm">{isVerified ? "Terverifikasi" : "Perlu verifikasi"}</Badge></li>;
          })}</ul>}
          <Link href="/dashboard/minecraft" className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-strong hover:underline">Kelola akun Minecraft <ArrowRight className="size-3.5" aria-hidden /></Link>
          <div className="mt-5 flex items-start gap-3 border-t border-line pt-4"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#6e9b7b]" aria-hidden /><div><h3 className="text-[12px] font-semibold text-ink">Keamanan akun</h3><p className="mt-1 text-[11px] leading-relaxed text-muted">{viewer.user.totpEnabledAt ? "2FA aktif untuk akun toko." : "Aktifkan 2FA untuk perlindungan ekstra."}</p><Link href="/dashboard/keamanan" className="mt-2 inline-block text-[11px] font-semibold text-accent-strong hover:underline">Atur keamanan →</Link></div></div>
        </section>
      </div>

      <section aria-labelledby="pesanan" className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-end justify-between gap-3"><div><p className="dashboard-kicker">YOUR RECENT ACTIVITY</p><h2 id="pesanan" className="mt-1 font-display text-[21px] text-ink">Pesanan terbaru<span className="text-accent">.</span></h2></div><Link href="/dashboard/pesanan" className="shrink-0 text-[11px] font-semibold text-accent-strong hover:underline">Semua pesanan ↗</Link></div>
        {orders.length === 0 ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-dashed border-[#e8d5e1] bg-[#fdf8fb] p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f7e8f1] text-accent"><Gift className="size-4" aria-hidden /></span><div><h3 className="text-[13px] font-semibold text-ink">Belum ada pesanan</h3><p className="mt-1 text-[12px] leading-relaxed text-muted">Riwayat pembelian dan status pengiriman akan muncul di sini.</p><Link href="/rank" className="mt-2 inline-block text-[12px] font-semibold text-accent-strong hover:underline">Jelajahi toko →</Link></div></div>
        ) : (
          <>
            <ul className="mt-5 space-y-2 sm:hidden">{orders.map((order) => <li key={order.id} className="rounded-xl border border-line bg-[#fdfafd] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[11px] text-ink">{order.orderNumber}</span><Badge tone={order.status === "DELIVERED" ? "success" : order.status === "PENDING" ? "accent" : "warning"}>{ORDER_STATUS_LABEL[order.status]}</Badge></div><p className="mt-2 text-[11px] text-muted">{order.mcName} · {formatDateTimeWIB(order.createdAt)}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="text-[13px] font-semibold text-ink">{formatRp(order.totalIdr)}</span><Link href={`/dashboard/pesanan/${order.id}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Detail <ArrowRight className="size-3" aria-hidden /></Link></div></li>)}</ul>
            <div className="dashboard-scroll mt-5 hidden overflow-x-auto rounded-xl border border-line sm:block" tabIndex={0} role="region" aria-label="Pesanan terbaru, gulir untuk melihat tabel">
              <table className="w-full min-w-[510px] text-left text-[12px]"><thead className="bg-[#fcf7fa] text-[10px] uppercase tracking-[.1em] text-muted-2"><tr><th scope="col" className="px-4 py-3 font-semibold">Pesanan</th><th scope="col" className="px-4 py-3 font-semibold">Tanggal</th><th scope="col" className="px-4 py-3 font-semibold">Total</th><th scope="col" className="px-4 py-3 font-semibold">Status</th><th scope="col" className="px-4 py-3"><span className="sr-only">Detail</span></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-line/70"><td className="px-4 py-3"><span className="font-mono text-[10.5px] text-ink">{order.orderNumber}</span><span className="mt-0.5 block text-[10px] text-muted-2">{order.mcName}</span></td><td className="px-4 py-3 text-muted">{formatDateTimeWIB(order.createdAt)}</td><td className="px-4 py-3 font-semibold text-ink">{formatRp(order.totalIdr)}</td><td className="px-4 py-3"><Badge tone={order.status === "DELIVERED" ? "success" : order.status === "PENDING" ? "accent" : "warning"}>{ORDER_STATUS_LABEL[order.status]}</Badge></td><td className="px-4 py-3 text-right"><Link href={`/dashboard/pesanan/${order.id}`} className="inline-flex items-center gap-1 font-semibold text-accent-strong hover:underline">Detail <ArrowRight className="size-3" aria-hidden /></Link></td></tr>)}</tbody></table>
            </div>
          </>
        )}
      </section>

      {past.length > 0 ? <section aria-labelledby="riwayat"><h2 id="riwayat" className="font-display text-[20px] text-ink">Riwayat season lalu</h2><ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">{past.slice(0, 8).map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[12px]"><span className="text-muted">{item.productName} · {item.seasonName}</span><span className="text-[11px] text-muted-2">Berakhir {formatDateWIB(item.seasonEndsAt)}</span></li>)}</ul></section> : null}
    </div>
  );
}
