"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/feedback";
import { lookupOrderAction } from "@/app/actions/checkout";

export function OrderLookupForm() {
  const [state, action] = useActionState(lookupOrderAction, {});

  return (
    <form action={action} className="mt-8 space-y-4">
      <Field label="Nomor order" htmlFor="orderNumber" required hint="CIPS-XXXXXXXX">
        <Input
          id="orderNumber"
          name="orderNumber"
          placeholder="CIPS-7K3M9QX2"
          required
          autoComplete="off"
          className="font-mono text-[13px] tracking-wide"
        />
      </Field>
      <Field label="Email pembelian" htmlFor="email" required>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="kamu@email.com" />
      </Field>
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <SubmitButton size="lg" className="w-full">
        Buka pesanan
      </SubmitButton>
    </form>
  );
}
