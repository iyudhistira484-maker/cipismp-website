"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resendVerificationAction, type AuthState } from "@/app/actions/auth";

export function ResendVerificationForm() {
  const [state, action] = useActionState(resendVerificationAction, {} as AuthState);
  return (
    <form action={action} className="mt-5">
      {state?.error ? <p className="mb-2 text-[12.5px] text-danger">{state.error}</p> : null}
      {state?.success ? <p className="mb-2 text-[12.5px] text-success">{state.success}</p> : null}
      <Button type="submit" variant="secondary" size="sm">
        Kirim ulang email verifikasi
      </Button>
    </form>
  );
}
