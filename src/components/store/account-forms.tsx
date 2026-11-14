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

export function AccountSecurityForms({ email, verified, customer = false }: { email: string; verified: boolean; customer?: boolean }) {
  const [passwordState, passwordAction] = useActionState(changePasswordAction, empty);
  const [emailState, emailAction] = useActionState(changeEmailAction, empty);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className={customer ? "rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6" : "rounded-lg border border-line bg-surface/60 p-4"}>
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

      <section className={customer ? "rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6" : "rounded-lg border border-line bg-surface/60 p-4"}>
        <h2 className="font-display text-[15px] text-ink">Ganti email</h2>
        <p className="mt-1 text-2xs text-muted-2">
          Email saat ini: <span className="break-all text-muted">{email}</span>{" "}
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

export function TotpPanel({ enabled, isStaff, customer = false }: { enabled: boolean; isStaff: boolean; customer?: boolean }) {
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
        const dataUrl = await QRCode.toDataURL(result.data.uri, { margin: 1, width: 220, color: { dark: "#342732", light: "#ffffff" } });
        setQr(dataUrl);
      }
    });
  }

  return (
    <section className={customer ? "rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6" : "rounded-lg border border-line bg-surface/60 p-4"}>
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
                <img src={qr} alt="Kode QR 2FA" width={150} height={150} className="rounded-md border border-line bg-white p-1" />
              ) : null}
              <div>
                <p className="text-2xs text-muted-2">Kode manual</p>
                <p className="mt-1 flex items-center gap-2">
                  <code className="break-all font-mono text-[10px] text-ink">{setup.secret}</code>
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
                      className="text-center font-mono text-[16px] tracking-[0.3em]"
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

export function DeleteAccountPanel({ customer = false }: { customer?: boolean }) {
  const [state, action] = useActionState(deleteAccountAction, empty);
  return (
    <section className={customer ? "rounded-[20px] border border-danger/25 bg-danger/[0.04] p-5 sm:p-6" : "rounded-lg border border-danger/25 bg-danger/[0.04] p-4"}>
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
  const [mcName, setMcName] = useState("");
  const [edition, setEdition] = useState("");

  return (
    <section aria-labelledby="verifikasi-minecraft" className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f9e9f2] font-display text-sm font-semibold text-accent-strong">01</span>
        <div><p className="dashboard-kicker">MULAI DI SINI</p><h2 id="verifikasi-minecraft" className="mt-1 font-display text-[21px] text-ink">Siapa nama pemainmu?</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">Gunakan nama yang sama seperti saat masuk ke server.</p></div>
      </div>
      <form action={action} className="mt-6 space-y-4">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        <Field label="Username Minecraft" htmlFor="mcName" required>
          <Input id="mcName" name="mcName" value={mcName} onChange={(event) => setMcName(event.target.value)} required placeholder="Contoh: CipiPlayer" autoComplete="off" aria-describedby="minecraft-name-hint" />
        </Field>
        <label htmlFor="mc-edition" className="block text-[13px] font-semibold text-ink">Edisi Minecraft</label>
        <select id="mc-edition" name="edition" value={edition} onChange={(event) => setEdition(event.target.value)} className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink">
          <option value="">Pilih edisi</option><option value="JAVA">Java</option><option value="BEDROCK">Bedrock</option>
        </select>
        <p id="minecraft-name-hint" className="text-[11.5px] leading-relaxed text-muted">Pilih edisi yang benar. Java: masukkan username seperti biasa. Bedrock: gunakan nama yang tampil di server beserta awalan garis bawah, misalnya <span className="font-mono text-ink">_CipiPlayer</span>. Nama Java juga bisa diawali _.</p>
        <SubmitButton className="w-full sm:w-auto">{state.data?.code ? "Buat kode baru" : "Buat kode verifikasi"}</SubmitButton>
      </form>
      {state.data?.code && state.data.playerName ? <VerificationSteps key={state.data.code} code={state.data.code} playerName={state.data.playerName} /> : (
        <div className="mt-6 rounded-2xl border border-dashed border-[#e6d2df] bg-[#fdf8fb] p-4"><p className="text-[11px] font-semibold text-ink">Perjalanan verifikasimu</p><ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] text-muted"><li>01 Username</li><li aria-hidden="true">→</li><li>02 Kode</li><li aria-hidden="true">→</li><li>03 Login</li><li aria-hidden="true">→</li><li>04 Verify</li></ol><p className="mt-3 text-[11px] leading-relaxed text-muted">Panduan login dan perintah verifikasi akan muncul setelah kode dibuat.</p></div>
      )}
    </section>
  );
}

function VerificationSteps({ code, playerName }: { code: string; playerName: string }) {
  const [check, setCheck] = useState<AccountState>({});
  const [checking, startCheck] = useTransition();
  const [copyMessage, setCopyMessage] = useState("");
  const router = useRouter();

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(`/verify ${code}`);
      setCopyMessage("Perintah disalin.");
    } catch {
      setCopyMessage("Tidak bisa menyalin otomatis. Pilih dan salin perintah di atas.");
    }
  }

  return (
    <div className="mt-7 border-t border-line pt-6">
      <ol className="space-y-6">
        <li className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f4ecf7] font-display text-sm font-semibold text-[#806096]">02</span>
          <div className="min-w-0 flex-1"><h3 className="text-[14px] font-semibold text-ink">Simpan kode verifikasi</h3><p className="mt-1 text-[12px] leading-relaxed text-muted">Kode untuk <strong className="break-words text-ink">{playerName}</strong> berlaku 15 menit dan hanya bisa dipakai sekali. Jangan bagikan ke orang lain.</p><div className="mt-3 rounded-xl border border-[#ead7e3] bg-[#fdf8fb] px-4 py-3"><span className="block text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2">Kode kamu</span><span className="mt-1 block select-all font-mono text-[22px] font-bold tracking-[.2em] text-ink">{code}</span></div><p className="mt-2 text-[11px] text-muted-2">Jika halaman dimuat ulang atau kode kedaluwarsa, buat kode baru.</p></div>
        </li>
        <li className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f4ecf7] font-display text-sm font-semibold text-[#806096]">03</span>
          <div className="min-w-0"><h3 className="text-[14px] font-semibold text-ink">Masuk dan login di server</h3><p className="mt-1 text-[12px] leading-relaxed text-muted">Bergabung sebagai <strong className="break-words text-ink">{playerName}</strong>, lalu selesaikan <span className="font-mono text-ink">/login</span> melalui LoginSecurity. Pemain baru harus mendaftar di server terlebih dahulu. Java dan Bedrock sama-sama perlu login.</p><p className="mt-2 text-[11px] leading-relaxed text-muted-2">Password server hanya dimasukkan di dalam game, bukan di halaman ini.</p></div>
        </li>
        <li className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f4ecf7] font-display text-sm font-semibold text-[#806096]">04</span>
          <div className="min-w-0 flex-1"><h3 className="text-[14px] font-semibold text-ink">Verifikasi di dalam game</h3><p className="mt-1 text-[12px] leading-relaxed text-muted">Setelah login berhasil, ketik perintah ini di chat server:</p><div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#3c2e3a] px-4 py-3 text-white"><code className="select-all break-all text-[13px]">/verify {code}</code><button type="button" onClick={copyCommand} className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><Copy className="size-3" aria-hidden /> Salin perintah</button></div><p role="status" className="mt-1 text-[11px] text-muted">{copyMessage}</p><p className="mt-3 text-[12px] leading-relaxed text-muted">Jika server mengonfirmasi verifikasi, kembali ke sini dan cek status akunmu.</p><Button type="button" variant="secondary" className="mt-3" loading={checking} onClick={() => startCheck(async () => { const result = await checkMinecraftVerificationAction(code); setCheck(result); if (result.success) router.refresh(); })}><Check className="size-3.5" aria-hidden /> Cek status verifikasi</Button><div aria-live="polite">{check.error ? <p className="mt-2 text-[12px] text-warning">{check.error}</p> : null}{check.success ? <p className="mt-2 text-[12px] text-success">{check.success}</p> : null}</div></div>
        </li>
      </ol>
    </div>
  );
}
