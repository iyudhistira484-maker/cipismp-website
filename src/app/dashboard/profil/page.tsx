import Link from "next/link";
import { ArrowUpRight, Gamepad2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { requireCustomer } from "@/server/auth/guard";
import { profilesForUser } from "@/server/minecraft";
import { formatDateWIB } from "@/lib/dates";
import { ProfileForm } from "@/components/dashboard/profile-form";

export const metadata = { title: "Profil", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const viewer = await requireCustomer("/dashboard/profil");
  const profiles = await profilesForUser(viewer.user.id);
  const name = viewer.user.displayName ?? viewer.user.username;
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[22px] border border-[#efdee8] bg-gradient-to-br from-[#fff3f8] via-[#fffafd] to-[#f2edf9] p-6 sm:p-8"><div className="pointer-events-none absolute -right-16 -top-24 size-56 rounded-full bg-white/50" aria-hidden /><div className="relative max-w-xl"><p className="eyebrow">Pengaturan akun</p><h1 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-tight text-ink">Profil saya<span className="text-accent">.</span></h1><p className="mt-3 text-[13px] leading-relaxed text-muted">Kelola identitas akun toko dan akses pengaturan pemainmu di satu tempat.</p></div></header>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(250px,.8fr)]">
        <section aria-labelledby="profile-details" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-7">
          <div className="flex items-center gap-4 border-b border-line pb-5"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#f9eaf2] font-display text-xl font-semibold text-accent-strong" aria-hidden>{name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="dashboard-kicker">IDENTITAS AKUN</p><h2 id="profile-details" className="mt-1 break-words font-display text-[19px] text-ink">{name}</h2><p className="mt-1 text-[12px] text-muted-2">Anggota sejak {formatDateWIB(viewer.user.createdAt)}</p></div></div>
          <ProfileForm displayName={name} username={viewer.user.username} />
        </section>
        <aside aria-label="Pengaturan terkait" className="space-y-4">
          <section className="rounded-[20px] border border-line bg-white p-5 shadow-card"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f9eaf2] text-accent-strong"><Mail className="size-4" aria-hidden /></span><div className="min-w-0"><h2 className="font-display text-[16px] text-ink">Email akun</h2><p className="mt-1 break-all text-[12px] text-muted">{viewer.user.email}</p><p className={`mt-1 text-[11px] font-semibold ${viewer.user.emailVerifiedAt ? "text-success" : "text-warning"}`}>{viewer.user.emailVerifiedAt ? "Terverifikasi" : "Belum terverifikasi"}</p></div></div><Link href="/dashboard/keamanan" className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Ubah email &amp; password <ArrowUpRight className="size-3.5" aria-hidden /></Link></section>
          <section className="rounded-[20px] border border-line bg-white p-5 shadow-card"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2ecfa] text-[#8963a1]"><Gamepad2 className="size-4" aria-hidden /></span><div><h2 className="font-display text-[16px] text-ink">Akun Minecraft</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">{profiles.length ? `${profiles.length} profil Minecraft tercatat. Periksa status verifikasinya di sini.` : "Hubungkan akun Java atau Bedrock untuk melihat item milikmu."}</p></div></div><Link href="/dashboard/minecraft" className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Kelola Minecraft <ArrowUpRight className="size-3.5" aria-hidden /></Link></section>
          <Link href="/dashboard/keamanan" className="group flex items-start gap-3 rounded-[20px] border border-[#ebdce9] bg-[#f9f4f9] p-5 hover:border-accent/40"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden /><span className="min-w-0 flex-1"><span className="block font-display text-[16px] text-ink">Jaga akunmu</span><span className="mt-1 block text-[12px] leading-relaxed text-muted">Kelola 2FA dan sesi aktif.</span></span><ArrowUpRight className="size-4 shrink-0 text-muted-2 group-hover:text-accent" aria-hidden /></Link>
          <div className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-muted-2"><UserRound className="mt-0.5 size-3.5 shrink-0" aria-hidden />Profil toko berbeda dari username Minecraft di server.</div>
        </aside>
      </div>
    </div>
  );
}
