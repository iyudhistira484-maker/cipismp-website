"use client";

import { useActionState, useEffect } from "react";
import { createSupportAction, customerReplySupportAction, staffReplySupportAction, closeSupportAction } from "@/app/actions/support";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function CreateSupportForm({ orders, selectedOrder }: { orders: Array<{ id: string; orderNumber: string }>; selectedOrder?: string }) {
  const [state, action] = useActionState(createSupportAction, {});
  return <form action={action} className="space-y-4">
    {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
    <Field label="Pesanan terkait" htmlFor="support-order" hint="Opsional; hanya pesanan milik akun ini yang dapat dipilih." className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1"><Select id="support-order" name="orderId" defaultValue={selectedOrder ?? ""}><option value="">Pertanyaan umum</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}</Select></Field>
    <Field label="Judul" htmlFor="support-subject" required><Input id="support-subject" name="subject" minLength={5} maxLength={120} required placeholder="Contoh: rank belum aktif" /></Field>
    <Field label="Ceritakan kendalanya" htmlFor="support-body" required hint="Jangan sertakan password, kode 2FA, atau data pembayaran rahasia." className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1"><Textarea id="support-body" name="body" rows={5} minLength={10} maxLength={3000} required /></Field>
    <SubmitButton size="sm">Kirim permintaan</SubmitButton>
  </form>;
}

export function SupportReplyForm({ id, staff = false }: { id: string; staff?: boolean }) {
  const [state, action] = useActionState(staff ? staffReplySupportAction : customerReplySupportAction, {});
  useEffect(() => { if (state.success) window.location.reload(); }, [state.success]);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="ticketId" value={id} />
    {state.error ? <Alert tone="danger">{state.error}</Alert> : null}{state.success ? <Alert tone="success">{state.success}</Alert> : null}
    <Field label="Tulis balasan" htmlFor="reply-body" required><Textarea id="reply-body" name="body" rows={4} minLength={2} maxLength={3000} required /></Field>
    <SubmitButton size="sm">Kirim balasan</SubmitButton>
  </form>;
}

export function CloseSupportForm({ id }: { id: string }) {
  const [state, action] = useActionState(closeSupportAction, {});
  useEffect(() => { if (state.success) window.location.reload(); }, [state.success]);
  return <form action={action} className="space-y-2"><input type="hidden" name="ticketId" value={id} />{state.error ? <Alert tone="danger">{state.error}</Alert> : null}<SubmitButton variant="secondary" size="sm">Tutup permintaan</SubmitButton></form>;
}
