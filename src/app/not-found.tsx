import Link from "next/link";
import { Logo } from "@/components/art/item-art";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-dvh flex-col items-center justify-center py-20 text-center">
      <Logo />
      <p className="eyebrow mt-8">404</p>
      <h1 className="mt-2 font-display text-h1 text-ink">Halaman ini tidak ada</h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted">
        Tautan mungkin salah ketik, produk sudah tidak dijual, atau halaman dipindahkan. Coba mulai dari
        daftar rank dan kit season ini.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/"><Button>Ke beranda</Button></Link>
        <Link href="/rank"><Button variant="secondary">Lihat rank</Button></Link>
        <Link href="/status-pesanan"><Button variant="ghost">Cek pesanan</Button></Link>
      </div>
    </div>
  );
}
