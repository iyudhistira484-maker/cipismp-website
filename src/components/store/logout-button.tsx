"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <SubmitInner />
    </form>
  );
}

function SubmitInner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-left text-[12.5px] text-muted-2 transition-colors hover:text-danger disabled:opacity-60"
    >
      <LogOut className="size-3.5" aria-hidden />
      {pending ? "Keluar…" : "Keluar"}
    </button>
  );
}
