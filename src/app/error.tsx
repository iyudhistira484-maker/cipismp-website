"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Kirim ke error tracking (Sentry-ready): cukup satu titik integrasi.
    console.error(JSON.stringify({ level: "error", msg: "client_error", digest: error.digest, message: error.message }));
  }, [error]);

  return (
    <div className="container-page flex min-h-[70dvh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">Terjadi kesalahan</p>
      <h1 className="mt-2 font-display text-h1 text-ink">Ada yang tidak berjalan semestinya</h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted">
        Kami sudah mencatat kejadian ini. Coba muat ulang halaman; kalau masalah berlanjut, buka status
        pesananmu untuk memastikan pembayaran tetap tercatat.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Muat ulang</Button>
        <Link href="/status-pesanan"><Button variant="secondary">Cek pesanan</Button></Link>
      </div>
      {error.digest ? <p className="mt-4 font-mono text-[10px] text-muted-2">ID: {error.digest}</p> : null}
    </div>
  );
}
