"use client";

import { useActionState } from "react";
import { updateNotificationPreferencesAction } from "@/app/actions/account";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";

export function NotificationSettingsForm({ dashboardOrderUpdates, emailDeliveryUpdates }: { dashboardOrderUpdates: boolean; emailDeliveryUpdates: boolean }) {
  const [state, action] = useActionState(updateNotificationPreferencesAction, {});
  return <form action={action} className="space-y-4">
    {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
    {state.success ? <Alert tone="success">{state.success}</Alert> : null}
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-white p-4"><input type="checkbox" name="dashboardOrderUpdates" defaultChecked={dashboardOrderUpdates} className="mt-1 accent-accent" /><span><span className="block text-[13px] font-semibold text-ink">Ringkasan pesanan di dashboard</span><span className="mt-1 block text-[12px] leading-relaxed text-muted">Tampilkan ringkasan pesanan dan simpan notifikasi pembayaran serta pengiriman baru di akunmu.</span></span></label>
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-white p-4"><input type="checkbox" name="emailDeliveryUpdates" defaultChecked={emailDeliveryUpdates} className="mt-1 accent-accent" /><span><span className="block text-[13px] font-semibold text-ink">Email saat pengiriman selesai</span><span className="mt-1 block text-[12px] leading-relaxed text-muted">Kirim email tambahan ketika pengiriman pesanan akun tercatat selesai.</span></span></label>
    <p className="text-[12px] leading-relaxed text-muted-2">Email penting seperti verifikasi, reset password, konfirmasi pesanan/pembayaran dan masalah pesanan tetap dikirim. Pengaturan ini tidak mengubah email tamu atau email yang sudah masuk antrean pengiriman.</p>
    <SubmitButton size="sm">Simpan pengaturan</SubmitButton>
  </form>;
}
