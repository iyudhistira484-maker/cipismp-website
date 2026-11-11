import type { Metadata } from "next";
import Link from "next/link";
import { VerifyEmailPanel } from "@/components/store/auth-forms";
import { getCurrentSession } from "@/server/auth/session";
import { ResendVerificationForm } from "@/components/store/resend-verification";

export const metadata: Metadata = { title: "Verifikasi email", robots: { index: false, follow: false } };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;
  const current = await getCurrentSession();
  const verified = Boolean(current?.user.emailVerifiedAt);

  return (
    <div>
      <p className="eyebrow">Verifikasi email</p>
      <h1 className="mt-2 font-display text-[30px] leading-tight text-ink">
        {verified ? "Email sudah terverifikasi" : "Satu klik lagi"}
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        {verified
          ? "Akun kamu aktif penuh. Kamu bisa checkout dengan akun dan melihat riwayat pembelian."
          : "Verifikasi email diperlukan untuk checkout dengan akun. Tanpa verifikasi, kamu tetap bisa checkout sebagai tamu."}
      </p>

      {status === "terkirim" ? (
        <p className="mt-4 rounded-md border border-info/25 bg-info/8 p-3 text-[13px] text-info">
          Email verifikasi sudah dikirim. Periksa kotak masuk dan folder spam.
        </p>
      ) : null}

      <div className="mt-6">
        <VerifyEmailPanel token={token} />
      </div>

      {current && !verified ? <ResendVerificationForm /> : null}

      <p className="mt-6 text-[12.5px] text-muted-2">
        <Link href="/dashboard" className="text-accent hover:underline">Buka dashboard</Link>
        {" · "}
        <Link href="/" className="hover:text-ink">Kembali ke toko</Link>
      </p>
    </div>
  );
}
