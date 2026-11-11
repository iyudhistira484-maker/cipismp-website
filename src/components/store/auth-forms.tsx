"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, Input, CheckboxField } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/feedback";
import {
  loginAction,
  registerAction,
  verifyMfaAction,
  forgotPasswordAction,
  resetPasswordAction,
  verifyEmailAction,
  type AuthState,
} from "@/app/actions/auth";

const initial: AuthState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Email atau username" htmlFor="identifier" required>
        <Input id="identifier" name="identifier" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <div className="flex items-center justify-between">
        <CheckboxField name="rememberMe" label="Ingat saya" />
        <Link href="/lupa-password" className="text-[13px] text-accent hover:underline">
          Lupa password?
        </Link>
      </div>
      <SubmitButton size="lg" className="w-full">Masuk</SubmitButton>
      <p className="text-center text-[13px] text-muted">
        Belum punya akun?{" "}
        <Link href="/daftar" className="text-accent hover:underline">Daftar</Link>
      </p>
    </form>
  );
}

export function MfaForm({ next }: { next: string }) {
  const [state, action] = useActionState(verifyMfaAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Kode 6 digit" htmlFor="code" hint="Dari aplikasi authenticator" required>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          autoComplete="one-time-code"
          className="text-center font-mono text-[18px] tracking-[0.35em]"
          placeholder="000000"
        />
      </Field>
      <SubmitButton size="lg" className="w-full">Verifikasi</SubmitButton>
      <p className="text-center text-[12.5px] text-muted-2">
        Kehilangan akses aplikasi? Hubungi bantuan dengan email akunmu.
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Email" htmlFor="email" required error={state.fields?.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Username toko" htmlFor="username" required error={state.fields?.username} hint="huruf, angka, _">
        <Input id="username" name="username" required autoComplete="username" />
      </Field>
      <Field label="Password" htmlFor="password" required error={state.fields?.password}>
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} withMeter />
      </Field>
      <Field label="Ulangi password" htmlFor="passwordConfirm" required error={state.fields?.passwordConfirm}>
        <PasswordInput id="passwordConfirm" name="passwordConfirm" autoComplete="new-password" required />
      </Field>
      <CheckboxField
        name="acceptTerms"
        label={
          <>
            Saya menyetujui{" "}
            <Link href="/legal/syarat-layanan" className="text-accent hover:underline">Syarat Layanan</Link>{" "}
            dan{" "}
            <Link href="/legal/kebijakan-privasi" className="text-accent hover:underline">Kebijakan Privasi</Link>,
            dan menyatakan berusia minimal 13 tahun atau mendapat izin wali.
          </>
        }
        error={state.fields?.acceptTerms}
      />
      <CheckboxField name="marketingOptIn" label="Kirim info season baru (opsional)." />
      <SubmitButton size="lg" className="w-full">Buat akun</SubmitButton>
      <p className="text-center text-[13px] text-muted">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="text-accent hover:underline">Masuk</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field label="Email akun" htmlFor="email" required>
        <Input id="email" name="email" type="email" required autoComplete="email" autoFocus />
      </Field>
      <SubmitButton size="lg" className="w-full">Kirim tautan reset</SubmitButton>
      <p className="text-center text-[13px] text-muted">
        Ingat password? <Link href="/masuk" className="text-accent hover:underline">Masuk</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <>
          <Alert tone="success">{state.success}</Alert>
          <Link href="/masuk">
            <SubmitButton type="button" size="lg" className="w-full">Masuk sekarang</SubmitButton>
          </Link>
        </>
      ) : (
        <>
          <Field label="Password baru" htmlFor="password" required error={state.fields?.password}>
            <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} withMeter />
          </Field>
          <Field label="Ulangi password baru" htmlFor="passwordConfirm" required>
            <PasswordInput id="passwordConfirm" name="passwordConfirm" autoComplete="new-password" required />
          </Field>
          <SubmitButton size="lg" className="w-full">Simpan password baru</SubmitButton>
          <p className="text-2xs leading-relaxed text-muted-2">
            Setelah disimpan, semua sesi lain otomatis dikeluarkan. Tautan ini hanya bisa dipakai sekali.
          </p>
        </>
      )}
    </form>
  );
}

export function VerifyEmailPanel({ token }: { token?: string }) {
  const [state, action] = useActionState(verifyEmailAction, initial);
  return (
    <div className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <>
          <Alert tone="success">{state.success}</Alert>
          <Link href="/dashboard"><SubmitButton size="lg" className="w-full">Buka dashboard</SubmitButton></Link>
        </>
      ) : token ? (
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton size="lg" className="w-full">Verifikasi email saya</SubmitButton>
        </form>
      ) : (
        <p className="text-[13.5px] leading-relaxed text-muted">
          Buka tautan verifikasi di email yang kami kirim. Tautan berlaku 60 menit dan hanya bisa dipakai sekali.
        </p>
      )}
    </div>
  );
}
