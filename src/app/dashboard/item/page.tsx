import Link from "next/link";
import { requireCustomer } from "@/server/auth/guard";
import { entitlementsForUser } from "@/server/entitlements";
import { profilesForUser } from "@/server/minecraft";
import { formatDateWIB, formatDateTimeWIB } from "@/lib/dates";
import { liveSnapshotsForUser } from "@/server/minecraft-live";
import { NotificationRefresh } from "@/components/dashboard/notification-refresh";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Rank & kit", robots: { index: false, follow: false } };

export default async function ItemsPage() {
  const viewer = await requireCustomer("/dashboard/item");
  const [items, profiles, liveSnapshots] = await Promise.all([entitlementsForUser(viewer.user.id), profilesForUser(viewer.user.id), liveSnapshotsForUser(viewer.user.id)]);
  const verified = profiles.some((profile) => profile.verifiedAt);
  const active = items.filter((item) => item.active && item.seasonStatus === "ACTIVE");
  const history = items.filter((item) => !item.active || item.seasonStatus === "ENDED");
  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Akun pemain</p><h1 className="mt-2 font-display text-h1 text-ink">Rank & kit</h1><p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">Hak yang tercatat untuk akun Minecraft terverifikasi, dikelompokkan menurut season.</p></header>
      <NotificationRefresh />
      <section aria-labelledby="game-status"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="game-status" className="font-display text-h3 text-ink">Pengamatan server</h2><span className="text-[11px] text-muted-2">Diperbarui setiap 30 detik saat halaman terbuka</span></div><p className="mt-1 text-[12px] leading-relaxed text-muted">Data hanya tersedia saat pemain online, plugin mengirimkan snapshot, dan akun Minecraft terverifikasi. Snapshot lebih dari 90 detik tidak ditampilkan.</p>{liveSnapshots.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{liveSnapshots.map((snapshot) => <article key={snapshot.profileId} className="rounded-xl border border-line bg-white p-5 shadow-card"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-ink">{snapshot.playerName}</h3><Badge tone="info">Pengamatan terbaru</Badge></div><p className="mt-2 text-[12px] text-muted">Grup utama LuckPerms: <span className="font-semibold text-ink">{snapshot.primaryGroup ?? "Tidak tersedia"}</span></p>{snapshot.kits.length ? <ul className="mt-3 space-y-1 text-[12px] text-muted">{snapshot.kits.map((kit) => <li key={kit.name}>Cooldown {kit.name}: <span className="font-semibold text-ink">{kit.cooldown ?? "Tidak tersedia"}</span></li>)}</ul> : <p className="mt-3 text-[12px] text-muted">Cooldown PlayerKits belum tersedia.</p>}<p className="mt-3 border-t border-line pt-3 text-[11px] text-muted-2">Diamati {formatDateTimeWIB(snapshot.observedAt)} WIB. Teks cooldown berasal dari PlayerKits dan tidak diperbarui setiap detik; ketersediaan klaim juga bergantung pada syarat di server.</p></article>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-line p-4 text-[12px] text-muted">Belum ada snapshot terbaru. Masuk ke server dan pastikan sinkronisasi plugin telah diaktifkan; data offline atau kedaluwarsa tidak ditampilkan.</p>}</section>
      <div className="rounded-lg border border-info/20 bg-info/5 p-4 text-[12px] leading-relaxed text-muted">Hak di bawah ini adalah catatan toko, bukan bukti permission atau inventaris langsung dari server.</div>
      <section aria-labelledby="item-active"><h2 id="item-active" className="font-display text-h3 text-ink">Hak season aktif</h2>
        {active.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{active.map((item) => <article key={item.id} className="rounded-xl border border-line bg-white p-5 shadow-card"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[11px] uppercase tracking-wider text-muted-2">{item.productType === "RANK" ? "Rank" : "Kit"}</p><h3 className="mt-1 font-display text-lg text-ink">{item.productName}</h3></div><Badge tone="success">Aktif di toko</Badge></div><p className="mt-3 text-[12px] text-muted">Pemain: {item.playerName ?? "—"}</p><p className="mt-1 text-[12px] text-muted">{item.seasonName} · berakhir {formatDateWIB(item.seasonEndsAt)} WIB</p>{item.productType === "KIT" ? <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">{["cipiprime", "cipi-plus-plus"].includes(item.productSlug) || /cipi(prime|\+\+)/i.test(item.productName) ? "Cooldown klaim PlayerKits: 5 jam. " : ""}Sisa cooldown dan status klaim perlu diperiksa di game.</p> : null}</article>)}</div> : <EmptyState className="mt-3" title={verified ? "Belum ada hak aktif" : "Hubungkan akun Minecraft"} description={verified ? "Hak rank dan kit akan muncul setelah tercatat untuk pemain yang terverifikasi." : "Verifikasi akun di dalam game agar hak pemain dapat ditampilkan."} action={<Link href={verified ? "/rank" : "/dashboard/minecraft"} className="text-[13px] text-accent hover:underline">{verified ? "Lihat rank" : "Hubungkan Minecraft"}</Link>} />}
      </section>
      {history.length ? <section aria-labelledby="item-history"><h2 id="item-history" className="font-display text-h3 text-ink">Riwayat hak</h2><div className="dashboard-scroll mt-3 max-h-80 overflow-y-auto rounded-lg border border-line bg-white" tabIndex={0} role="region" aria-label="Riwayat hak, gulir untuk melihat semua"><ul className="divide-y divide-line">{history.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 p-4 text-[12px]"><span className="text-ink">{item.productName} · {item.playerName ?? "—"}</span><span className="text-muted">{item.seasonName} · {item.seasonStatus === "ENDED" ? "season berakhir" : "hak tidak aktif"}</span></li>)}</ul></div></section> : null}
      <Link href="/dashboard/pesanan" className="inline-block text-[12px] font-semibold text-accent-strong hover:underline">Lihat status pesanan →</Link>
    </div>
  );
}
