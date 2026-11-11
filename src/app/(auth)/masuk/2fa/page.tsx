import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";
import { MfaForm } from "@/components/store/auth-forms";
import { safeNext } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Verifikasi 2FA", robots: { index: false, follow: false } };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const current = await getCurrentSession();
  if (!current) redirect("/masuk");
  if (!current.user.totpEnabledAt) redirect(safeNext(next));
  if (current.session.mfaSatisfiedAt) redirect(safeNext(next));

  return (
    <div>
      <p className="eyebrow">Langkah kedua</p>
      <h1 className="mt-2 font-display text-[30px] leading-tight text-ink">Masukkan kode 2FA</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Buka aplikasi authenticator untuk akun {current.user.email}, lalu masukkan kode 6 digit yang berlaku.
      </p>
      <div className="mt-7">
        <MfaForm next={safeNext(next)} />
      </div>
      <p className="mt-4 text-[12.5px] text-muted-2">
        Bukan kamu?{" "}
        <Link href="/masuk" className="text-accent hover:underline">Kembali ke halaman masuk</Link>
      </p>
    </div>
  );
}
