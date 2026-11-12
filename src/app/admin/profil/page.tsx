import Link from "next/link";
import { ArrowUpRight, Mail, ShieldCheck } from "lucide-react";
import { requireStaff } from "@/server/auth/guard";
import { redirect } from "next/navigation";
import { ROLE_LABEL } from "@/server/rbac";
import { formatDateWIB } from "@/lib/dates";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { AdminPageHeader } from "@/components/admin/shell";

export const metadata = { title: "Profil admin" };

export default async function AdminProfilePage() {
  const viewer = await requireStaff();
  if (!viewer.user.totpEnabledAt) redirect("/admin/keamanan");
  const name = viewer.user.displayName ?? viewer.user.username;
  return (
    <>
      <AdminPageHeader title="Profil admin" description="Kelola identitas akun staf yang digunakan untuk mengakses panel admin." />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(250px,.8fr)]">
        <section className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-7">
          <div className="flex items-center gap-4 border-b border-line pb-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#f9eaf2] font-display text-xl font-semibold text-accent-strong" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0"><p className="dashboard-kicker">IDENTITAS STAF</p><h2 className="mt-1 break-words font-display text-lg text-ink">{name}</h2><p className="mt-1 text-[12px] text-muted-2">{ROLE_LABEL[viewer.user.role]} · Sejak {formatDateWIB(viewer.user.createdAt)}</p></div>
          </div>
          <ProfileForm displayName={name} username={viewer.user.username} staff />
        </section>
        <div className="space-y-4">
          <section className="rounded-[20px] border border-line bg-white p-5 shadow-card">
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-accent-strong"><Mail className="size-4" /></span><div className="min-w-0"><h2 className="text-[14px] font-semibold text-ink">Email admin</h2><p className="mt-1 break-all text-[12px] text-muted">{viewer.user.email}</p><p className={`mt-1 text-[11px] ${viewer.user.emailVerifiedAt ? "text-success" : "text-warning"}`}>{viewer.user.emailVerifiedAt ? "Terverifikasi" : "Belum terverifikasi"}</p></div></div>
            <Link href="/admin/keamanan" className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-accent-strong hover:underline">Ubah email & password <ArrowUpRight className="size-3.5" /></Link>
          </section>
          <Link href="/admin/keamanan" className="flex items-center gap-3 rounded-[20px] border border-[#ebdce9] bg-[#f9f4f9] p-5 text-[12px] text-muted hover:border-accent/40"><ShieldCheck className="size-4 shrink-0 text-success" />Kelola 2FA dan sesi admin <ArrowUpRight className="ml-auto size-3.5" /></Link>
          <p className="px-1 text-[12px] leading-relaxed text-muted-2">Profil ini terpisah dari akun pemain. Akun admin hanya untuk pengelolaan toko.</p>
        </div>
      </div>
    </>
  );
}
