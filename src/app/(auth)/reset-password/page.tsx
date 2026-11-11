import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/store/auth-forms";
import { Alert } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Password baru", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div>
        <h1 className="font-display text-[28px] text-ink">Tautan tidak lengkap</h1>
        <Alert tone="warning" className="mt-4" title="Token reset tidak ditemukan">
          Buka tautan dari email terbaru, atau minta tautan baru.
        </Alert>
        <Link href="/lupa-password" className="mt-4 inline-block text-[13px] text-accent hover:underline">
          Minta tautan baru
        </Link>
      </div>
    );
  }
  return (
    <div>
      <p className="eyebrow">Password baru</p>
      <h1 className="mt-2 font-display text-[30px] leading-tight text-ink">Buat password baru</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Setelah disimpan, semua sesi lain dikeluarkan agar akunmu aman.
      </p>
      <div className="mt-7">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
