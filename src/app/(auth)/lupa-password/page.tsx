import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "Lupa password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <div>
      <p className="eyebrow">Pemulihan akun</p>
      <h1 className="mt-2 font-display text-[30px] leading-tight text-ink">Atur ulang password</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Masukkan email akun. Kami mengirim tautan yang berlaku 45 menit dan hanya bisa dipakai sekali.
      </p>
      <div className="mt-7">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
