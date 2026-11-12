import Link from "next/link";
import { ArrowUpRight, Gamepad2, Mail, ShieldCheck } from "lucide-react";
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
      <header><p className="eyebrow">Pengaturan akun</p><h1 className="mt-2 font-display text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-ink">Profil saya</h1><p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">Kelola identitas akun toko dan akses pengaturan pemainmu di satu tempat.</p></header>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(250px,.8fr)]">
        <section className="rounded-xl border border-line bg-white p-5 shadow-card sm:p-7">
          <div className="flex items-center gap-4 border-b border-line pb-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-surface-3 font-display text-xl font-semibold text-accent-strong">{name.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0"><h2 className="truncate font-display text-lg text-ink">{name}</h2><p className="mt-1 text-[12px] text-muted-2">Anggota sejak {formatDateWIB(viewer.user.createdAt)}</p></div>
          </div>
          <ProfileForm displayName={name} username={viewer.user.username} />
        </section>
        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-white p-5 shadow-card">
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-accent-strong"><Mail className="size-4" /></span><div className="min-w-0"><h2 className="text-[14px] font-semibold text-ink">Email akun</h2><p className="mt-1 break-all text-[12px] text-muted">{viewer.user.email}</p><p className={`mt-1 text-[11px] ${viewer.user.emailVerifiedAt ? "text-success" : "text-warning"}`}>{viewer.user.emailVerifiedAt ? "Terverifikasi" : "Belum terverifikasi"}</p></div></div>
            <Link href="/dashboard/keamanan" className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-accent-strong hover:underline">Ubah email & password <ArrowUpRight className="size-3.5" /></Link>
          </section>
          <section className="rounded-xl border border-line bg-white p-5 shadow-card">
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-accent-strong"><Gamepad2 className="size-4" /></span><div><h2 className="text-[14px] font-semibold text-ink">Akun Minecraft</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">{profiles.length ? `${profiles.length} akun terhubung. Kelola verifikasi dan identitas pemain di sini.` : "Hubungkan akun Java atau Bedrock untuk melihat item milikmu."}</p></div></div>
            <Link href="/dashboard/minecraft" className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-accent-strong hover:underline">Kelola Minecraft <ArrowUpRight className="size-3.5" /></Link>
          </section>
          <Link href="/dashboard/keamanan" className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-4 text-[12px] text-muted hover:border-line-strong"><ShieldCheck className="size-4 shrink-0 text-success" />Kelola 2FA dan sesi aktif <ArrowUpRight className="ml-auto size-3.5" /></Link>
        </div>
      </div>
    </div>
  );
}
