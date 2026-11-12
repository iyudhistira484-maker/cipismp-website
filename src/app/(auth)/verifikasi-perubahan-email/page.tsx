import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Konfirmasi email", robots: { index: false, follow: false } };

export default async function EmailChangePage({ searchParams }: { searchParams: Promise<{ token?: string; status?: string }> }) {
  const { token, status } = await searchParams;
  const success = status === "berhasil";
  const failed = !success && (status === "gagal" || !token);

  return (
    <div>
      <p className="eyebrow">Perubahan email</p>
      <h1 className="mt-2 font-display text-[28px] leading-tight text-ink">
        {success ? "Email diperbarui" : failed ? "Tautan tidak bisa dipakai" : "Konfirmasi alamat email baru"}
      </h1>
      {success ? (
        <Alert tone="success" className="mt-4">Email baru sudah disimpan. Demi keamanan, semua sesi dikeluarkan; silakan masuk kembali.</Alert>
      ) : failed ? (
        <Alert tone="warning" className="mt-4">
          Tautan konfirmasi tidak valid atau sudah kedaluwarsa. Minta perubahan email baru dari halaman
          keamanan akun.
        </Alert>
      ) : (
        <form action={`/api/auth/confirm-email-change?token=${encodeURIComponent(token ?? "")}`} method="post" className="mt-5">
          <p className="text-[13.5px] leading-relaxed text-muted">
            Setelah dikonfirmasi, alamat email baru dipakai untuk kuitansi dan pemberitahuan pengiriman.
            Kamu perlu memverifikasi email ini sebelum checkout dengan akun.
          </p>
          <button
            type="submit"
            className="mt-4 inline-flex h-11 items-center rounded-md bg-accent px-5 text-[14px] font-medium text-accent-ink transition-colors hover:bg-accent-strong"
          >
            Konfirmasi email
          </button>
        </form>
      )}
      <Link href="/masuk" className="mt-6 inline-block text-[12.5px] text-accent hover:underline">
        Kembali ke halaman masuk
      </Link>
    </div>
  );
}
