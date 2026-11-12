import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/store/auth-forms";
import { getViewer } from "@/server/auth/guard";
import { getSettings } from "@/server/settings";
import { Alert } from "@/components/ui/feedback";
import { headers } from "next/headers";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Daftar", robots: { index: false, follow: false } };

export default async function RegisterPage() {
  const viewer = await getViewer();
  if (viewer) redirect("/dashboard");
  const settings = await getSettings();

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-strong">MULAI PETUALANGANMU <span aria-hidden>✦</span></p>
      <h1 className="mt-3 font-display text-[32px] leading-[1.1] tracking-[-0.04em] text-ink">Buat akun CipiSMP<span className="text-accent">.</span></h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Satu akun untuk semua ceritamu di CipiSMP. Usia minimum {settings.store.minimumAge} tahun.
      </p>
      <div className="mt-7">
        <RegisterForm turnstileEnabled={env.TURNSTILE_ENABLED} turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} nonce={(await headers()).get("x-nonce") ?? undefined} />
      </div>
      <Alert tone="info" className="mt-6" title="Email verifikasi">
        Kami mengirim tautan verifikasi. Checkout dengan akun memerlukan email yang sudah terverifikasi;
        checkout sebagai tamu tidak.
      </Alert>
    </div>
  );
}
