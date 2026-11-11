import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/store/auth-forms";
import { getViewer } from "@/server/auth/guard";
import { getSettings } from "@/server/settings";
import { Alert } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Daftar", robots: { index: false, follow: false } };

export default async function RegisterPage() {
  const viewer = await getViewer();
  if (viewer) redirect("/dashboard");
  const settings = await getSettings();

  return (
    <div>
      <p className="eyebrow">Akun baru</p>
      <h1 className="mt-2 font-display text-[30px] leading-tight text-ink">Buat akun CipiSMP</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Butuh 30 detik. Usia minimum {settings.store.minimumAge} tahun. Kamu tetap bisa checkout tanpa akun,
        tetapi akun memudahkan melihat riwayat dan status pengiriman.
      </p>
      <div className="mt-7">
        <RegisterForm />
      </div>
      <Alert tone="info" className="mt-6" title="Email verifikasi">
        Kami mengirim tautan verifikasi. Checkout dengan akun memerlukan email yang sudah terverifikasi;
        checkout sebagai tamu tidak.
      </Alert>
    </div>
  );
}
