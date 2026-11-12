"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions/account";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";

export function ProfileForm({ displayName, username, staff = false }: { displayName: string; username: string; staff?: boolean }) {
  const [state, action] = useActionState(updateProfileAction, {});
  return (
    <form action={action} className="mt-6 space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field label="Nama tampilan" htmlFor="profile-display-name" hint="Nama yang tampil di dashboard dan akunmu." required className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1">
        <Input id="profile-display-name" name="displayName" defaultValue={displayName} minLength={2} maxLength={40} autoComplete="name" required />
      </Field>
      <Field label="Username akun" htmlFor="profile-username" hint="3–20 karakter; huruf, angka, dan garis bawah. Digunakan untuk masuk." required className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1">
        <Input id="profile-username" name="username" defaultValue={username} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoComplete="username" required />
      </Field>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <SubmitButton size="sm">Simpan perubahan</SubmitButton>
        <span className="text-[12px] text-muted-2">{staff ? "Perubahan hanya berlaku untuk akun admin ini." : "Tidak mengubah nama Minecraft."}</span>
      </div>
    </form>
  );
}
