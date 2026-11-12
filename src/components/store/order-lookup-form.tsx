"use client";

import { useActionState, useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/feedback";
import { lookupOrderAction } from "@/app/actions/checkout";

export function OrderLookupForm() {
  const [state, action] = useActionState(lookupOrderAction, {});
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Nomor order" htmlFor="orderNumber" required hint="CIPS-XXXXXXXX">
        <Input
          id="orderNumber"
          name="orderNumber"
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
          placeholder="CIPS-7K3M9QX2"
          required
          autoComplete="off"
          className="font-mono text-[13px] tracking-wide"
        />
      </Field>
      <Field label="Email pembelian" htmlFor="email" required>
        <Input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="kamu@email.com" />
      </Field>
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <SubmitButton size="lg" className="w-full">
        Buka pesanan
      </SubmitButton>
    </form>
  );
}
