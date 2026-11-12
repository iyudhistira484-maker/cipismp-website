import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Logo } from "@/components/art/item-art";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Akses ditolak", robots: { index: false, follow: false } };

export default function ForbiddenPage() {
  return (
    <div className="container-page flex min-h-dvh flex-col items-center justify-center py-20 text-center">
      <Logo />
      <ShieldX className="mt-10 size-8 text-warning" aria-hidden />
      <h1 className="mt-4 font-display text-h1 text-ink">Akses ditolak</h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted">
        Akunmu tidak punya izin untuk halaman ini. Kalau kamu bagian dari tim CipiSMP, minta Owner
        menyesuaikan role atau aktifkan 2FA terlebih dahulu.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/"><Button>Ke beranda</Button></Link>
        <Link href="/dashboard"><Button variant="secondary">Dashboard</Button></Link>
      </div>
    </div>
  );
}
