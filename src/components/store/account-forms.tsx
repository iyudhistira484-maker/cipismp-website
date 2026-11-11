"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import {
  changeEmailAction,
  changePasswordAction,
  confirmTotpAction,
  deleteAccountAction,
  disableTotpAction,
  startMinecraftVerificationAction,
  startTotpSetupAction,
  checkMinecraftVerificationAction,
  type AccountState,
} from "@/app/actions/account";

const empty: AccountState = {};

export function AccountSecurityForms({ email, verified }: { email: string; verified: boolean }) {
  const [passwordState, passwordAction] = useActionState(changePasswordAction, empty);
  const [emailState, emailAction] = useActionState(changeEmailAction, empty);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-lg border border-line bg-surface/60 p-4">
        <h2 className="font-display text-[15px] text-ink">Ganti password</h2>
        <form action={passwordAction} className="mt-3 space-y-3">
          {passwordState.error ? <Alert tone="danger">{passwordState.error}</Alert> : null}
          {passwordState.success ? <Alert tone="success">{passwordState.success}</Alert> : null}
          <Field label="Password saat ini" htmlFor="currentPassword" required>
            <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
          </Field>
          <Field label="Password baru" htmlFor="newPassword" required>
            <PasswordInput id="newPassword" name="password" autoComplete="new-password" required withMeter />
          </Field>
          <Field label="Ulangi password baru" htmlFor="confirmPassword" required>
            <PasswordInput id="confirmPassword" name="passwordConfirm" autoComplete="new-password" required />
          </Field>
          <SubmitButton size="sm">Simpan password</SubmitButton>
          <p className="text-2xs text-muted-2">Semua sesi lain akan dikeluarkan setelah password berubah.</p>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-surface/60 p-4">
        <h2 className="font-display text-[15px] text-ink">Ganti email</h2>
        <p className="mt-1 text-2xs text-muted-2">
          Email saat ini: <span className="text-muted">{email}</span>{" "}
          {verified ? <span className="text-success">(terverifikasi)</span> : <span className="text-warning">(belum terverifikasi)</span>}
        </p>
        <form action={emailAction} className="mt-3 space-y-3">
          {emailState.error ? <Alert tone="danger">{emailState.error}</Alert> : null}
          {emailState.success ? <Alert tone="success">{emailState.success}</Alert> : null}
          <Field label="Email baru" htmlFor="newEmail" required>
            <Input id="newEmail" name="email" type="email" required autoComplete="email" />
          </Field>
          <SubmitButton size="sm" variant="secondary">Kirim tautan konfirmasi</SubmitButton>
          <p className="text-2xs text-muted-2">
            Email baru aktif setelah dikonfirmasi. Kamu perlu verifikasi ulang sebelum checkout dengan akun.
          </p>
        </form>
      </section>
    </div>
  );
}

export function TotpPanel({ enabled, isStaff }: { enabled: boolean; isStaff: boolean }) {
  const [setup, setSetup] = useState<{ uri: string; secret: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<AccountState>({});
  const [confirmState, confirmAction] = useActionState(confirmTotpAction, empty);
  const [disableState, disableAction] = useActionState(disableTotpAction, empty);
  const [starting, startTransition] = useTransition();

  function begin() {
    startTransition(async () => {
      const result = await startTotpSetupAction();
      if (result.error) {
        setState({ error: result.error });
        return;
      }
      if (result.data?.uri) {
        setSetup({ uri: result.data.uri, secret: result.data.secret ?? "" });
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(result.data.uri, { margin: 1, width: 220, color: { dark: "#15130f", light: "#f5f2ec" } });
        setQr(dataUrl);
      }
    });
  }

  return (
    <section className="rounded-lg border border-line bg-surface/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[15px] text-ink">
          <ShieldCheck className="size-4 text-success" aria-hidden />
          Autentikasi dua faktor (TOTP)
        </h2>
        <span className={`text-2xs ${enabled ? "text-success" : "text-warning"}`}>
          {enabled ? "Aktif" : isStaff ? "Wajib untuk staf" : "Belum aktif"}
        </span>
      </div>

      {state.error || confirmState.error || disableState.error ? (
        <div className="mt-3"><Alert tone="danger">{state.error ?? confirmState.error ?? disableState.error}</Alert></div>
      ) : null}
      {confirmState.success ? <div className="mt-3"><Alert tone="success">{confirmState.success}</Alert></div> : null}
      {disableState.success ? <div className="mt-3"><Alert tone="success">{disableState.success}</Alert></div> : null}

      {enabled ? (
        isStaff ? (
          <p className="mt-2 text-2xs leading-relaxed text-muted-2">
            2FA wajib aktif untuk akun staf dan tidak dapat dinonaktifkan sendiri. Hubungi Owner bila perlu reset.
          </p>
        ) : (
          <form action={disableAction} className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Password" htmlFor="disable-password" className="flex-1">
              <PasswordInput id="disable-password" name="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton size="sm" variant="secondary">Nonaktifkan 2FA</SubmitButton>
          </form>
        )
      ) : (
        <div className="mt-3">
          {!setup ? (
            <>
              <p className="text-[12.5px] leading-relaxed text-muted">
                Gunakan aplikasi authenticator (Google Authenticator, Aegis, 1Password, dsb). Scan kode QR,
                lalu masukkan 6 digit pertama untuk mengaktifkan.
              </p>
              <Button type="button" size="sm" variant="secondary" className="mt-3" loading={starting} onClick={begin}>
                <KeyRound className="size-3.5" aria-hidden />
                Mulai pengaturan
              </Button>
            </>
          ) : (
            <div className="mt-2 grid gap-4 sm:grid-cols-[auto_1fr]">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="Kode QR 2FA" width={150} height={150} className="rounded-md border border-line bg-[#f5f2ec] p-1" />
              ) : null}
              <div>
                <p className="text-2xs text-muted-2">Kode manual</p>
                <p className="mt-1 flex items-center gap-2">
                  <code className="break-all font-pixel text-[10px] text-ink">{setup.secret}</code>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(setup.secret)}
                    className="rounded border border-line px-1.5 py-0.5 text-2xs text-muted hover:text-accent"
                  >
                    <Copy className="size-3" aria-hidden />
                  </button>
                </p>
                <form action={confirmAction} className="mt-3 space-y-2">
                  <Field label="Kode dari aplikasi" htmlFor="totp-code">
                    <Input
                      id="totp-code"
                      name="code"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      className="text-center font-pixel text-[16px] tracking-[0.3em]"
                      placeholder="000000"
                    />
                  </Field>
                  <SubmitButton size="sm">Aktifkan 2FA</SubmitButton>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function DeleteAccountPanel() {
  const [state, action] = useActionState(deleteAccountAction, empty);
  return (
    <section className="rounded-lg border border-danger/25 bg-danger/[0.04] p-4">
      <h2 className="font-display text-[15px] text-ink">Hapus akun</h2>
      <p className="mt-1 text-2xs leading-relaxed text-muted-2">
        Akun dihapus dan semua sesi dikeluarkan. Catatan transaksi yang telah dibayar tetap disimpan untuk
        pembukuan, sesuai Kebijakan Privasi. Tindakan ini tidak dapat dibatalkan.
      </p>
      <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {state.error ? <div className="sm:col-span-3"><Alert tone="danger">{state.error}</Alert></div> : null}
        <Field label="Password" htmlFor="delete-password">
          <PasswordInput id="delete-password" name="password" autoComplete="current-password" required />
        </Field>
        <Field label='Tulis "HAPUS AKUN"' htmlFor="confirmation">
          <Input id="confirmation" name="confirmation" required placeholder="HAPUS AKUN" />
        </Field>
        <SubmitButton size="sm" variant="danger">Hapus akun</SubmitButton>
      </form>
    </section>
  );
}

export function MinecraftPanel() {
  const [state, action] = useActionState(startMinecraftVerificationAction, empty);
  const [check, setCheck] = useState<AccountState>({});
  const [checking, startCheck] = useTransition();
  const router = useRouter();

  return (
    <section className="rounded-lg border border-line bg-surface/60 p-4">
      <h2 className="font-display text-[15px] text-ink">Verifikasi in-game</h2>
      <form action={action} className="mt-3 space-y-3">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        <Field label="Username Minecraft" htmlFor="mcName" hint="Bedrock pakai titik">
          <Input id="mcName" name="mcName" required placeholder="CipiPlayer" autoComplete="off" />
        </Field>
        <SubmitButton size="sm">Buat kode verifikasi</SubmitButton>
      </form>

      {state.data?.code ? (
        <div className="mt-4 rounded-md border border-accent/30 bg-accent/[0.06] p-3.5">
          <p className="text-2xs uppercase tracking-wider text-accent">Kode verifikasi</p>
          <p className="mt-1 select-all font-pixel text-[20px] tracking-[0.25em] text-ink">{state.data.code}</p>
          <p className="mt-2 text-2xs leading-relaxed text-muted">
            Masuk ke server sebagai <span className="text-ink">{state.data.playerName}</span>, lalu ketik{" "}
            <span className="font-pixel text-[10px] text-ink">/verify {state.data.code}</span>. Kode berlaku 15 menit
            dan hanya bisa dipakai sekali.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={checking}
              onClick={() =>
                startCheck(async () => {
                  const result = await checkMinecraftVerificationAction();
                  setCheck(result);
                  if (result.success) router.refresh();
                })
              }
            >
              <Check className="size-3.5" aria-hidden />
              Cek status
            </Button>
          </div>
          {check.error ? <p className="mt-2 text-2xs text-warning">{check.error}</p> : null}
          {check.success ? <p className="mt-2 text-2xs text-success">{check.success}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
