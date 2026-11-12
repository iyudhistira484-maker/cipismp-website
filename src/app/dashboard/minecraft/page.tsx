import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Gamepad2, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { requireCustomer } from "@/server/auth/guard";
import { profilesForUser } from "@/server/minecraft";
import { env } from "@/server/env";
import { MinecraftPanel } from "@/components/store/account-forms";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeWIB } from "@/lib/dates";
import { unlinkMinecraftAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Akun Minecraft", robots: { index: false, follow: false } };

export default async function MinecraftPage() {
  const viewer = await requireCustomer("/dashboard/minecraft");
  const profiles = await profilesForUser(viewer.user.id);

  return (
    <div className="space-y-6 sm:space-y-7">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-accent-strong"><ArrowLeft className="size-3.5" aria-hidden /> Kembali ke ringkasan</Link>
      <header className="relative isolate overflow-hidden rounded-[22px] bg-[#493342] px-6 py-8 text-white shadow-[0_18px_45px_-28px_rgba(69,35,55,.6)] sm:px-9 sm:py-10">
        <div className="absolute inset-0 -z-10 bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#2f1c2c]/95 via-[#4d3044]/90 to-[#4a3042]/65" aria-hidden />
        <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.17em] text-[#ffe0ee]"><Sparkles className="size-3" aria-hidden /> YOUR PLAYER IDENTITY</p>
        <h1 className="mt-5 max-w-xl font-display text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.1] tracking-[-.04em]">Hubungkan akun Minecraft<span className="text-[#f6b6d1]">.</span></h1>
        <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-white/80">Satu langkah lebih dekat ke petualanganmu. Ikuti panduan ini untuk menghubungkan pemain Java atau Bedrock dengan aman.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Java Edition</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Bedrock Edition</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Verifikasi di game</span></div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
        <MinecraftPanel />
        <div className="space-y-5">
          <section aria-labelledby="akun-terhubung" className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="dashboard-kicker">YOUR PLAYERS</p><h2 id="akun-terhubung" className="mt-1 font-display text-[21px] text-ink">Akun terhubung<span className="text-accent">.</span></h2><p className="mt-1 text-[11.5px] leading-relaxed text-muted">Pemain yang terhubung ke akun toko ini.</p></div><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2ecfa] text-[#8c69ab]"><Gamepad2 className="size-5" aria-hidden /></span></div>
            {profiles.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-[#e8d5e1] bg-[#fdf8fb] px-5 py-7 text-center"><p className="text-[13px] font-semibold text-ink">Belum ada akun terhubung</p><p className="mt-1 text-[12px] leading-relaxed text-muted">Mulai dengan username Minecraft pertamamu.</p></div> : <ul className="dashboard-scroll mt-4 max-h-[30rem] space-y-2 overflow-y-auto pr-1" tabIndex={0} aria-label="Daftar akun Minecraft terhubung">{profiles.map((profile) => {
              const verified = Boolean(profile.verifiedAt && (env.MINECRAFT_LOOKUP_MODE !== "offline" || profile.identityVerifiedVersion === 2));
              return <li key={profile.id} className="rounded-2xl border border-[#f0e5ec] bg-[#fdfafd] p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f0e4ef] font-display font-semibold text-accent-strong">{profile.displayName.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="break-all text-[13px] font-semibold text-ink">{profile.displayName}</h3><Badge tone={verified ? "success" : "neutral"} size="sm">{verified ? "Terverifikasi" : "Perlu verifikasi ulang"}</Badge></div><p className="mt-1 text-[11px] text-muted">{profile.edition === "BEDROCK" ? "Bedrock Edition" : "Java Edition"}</p>{verified && profile.verifiedAt ? <p className="mt-1 text-[10px] leading-relaxed text-muted-2">Terverifikasi {formatDateTimeWIB(profile.verifiedAt)} WIB</p> : <p className="mt-1 text-[10px] leading-relaxed text-muted-2">Buat kode baru untuk verifikasi ulang di server.</p>}</div></div><form action={unlinkMinecraftAction} className="mt-3 border-t border-line pt-2"><input type="hidden" name="profileId" value={profile.id} /><Button type="submit" variant="ghost" size="sm" aria-label={`Lepas tautan ${profile.displayName}`}>Lepas tautan</Button></form></li>;
            })}</ul>}
          </section>
          <section className="rounded-[20px] border border-[#e9dce9] bg-[#f9f4f9] p-5 sm:p-6"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#8d6a99]" aria-hidden /><div><h2 className="text-[13px] font-semibold text-ink">Akunmu, identitasmu</h2><p className="mt-1.5 text-[12px] leading-relaxed text-muted">Rank dan kit terikat ke UUID yang digunakan server. Pada server offline, perubahan nama dapat mengubah UUID dan akses tidak otomatis berpindah. Hubungi staf jika membutuhkan bantuan.</p></div></div></section>
          <section className="rounded-[20px] border border-line bg-white p-5 sm:p-6"><div className="flex gap-3"><HeartHandshake className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden /><div><h2 className="text-[13px] font-semibold text-ink">Butuh bantuan?</h2><p className="mt-1.5 text-[12px] leading-relaxed text-muted">Lihat panduan masuk ke server atau hubungi tim jika verifikasi mengalami kendala.</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] font-semibold text-accent-strong"><Link href="/cara-kerja" className="inline-flex items-center gap-1 hover:underline">Panduan bermain <ArrowUpRight className="size-3" aria-hidden /></Link><Link href="/dashboard/bantuan" className="inline-flex items-center gap-1 hover:underline">Pusat bantuan <ArrowUpRight className="size-3" aria-hidden /></Link></div></div></div></section>
        </div>
      </div>
    </div>
  );
}
