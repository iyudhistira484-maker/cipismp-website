import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/store/auth-forms";
import { getViewer } from "@/server/auth/guard";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Masuk", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const viewer = await getViewer();
  if (viewer) redirect(safeNext(next));

  return (
    <div>
      <p className="eyebrow">Akun</p>
      <h1 className="mt-2 font-display text-[30px] leading-tight text-ink">Masuk ke CipiSMP</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Email atau username toko, lalu password. Kalau 2FA aktif, kamu akan diminta kode 6 digit.
      </p>
      <div className="mt-7">
        <LoginForm next={safeNext(next)} />
      </div>
    </div>
  );
}
