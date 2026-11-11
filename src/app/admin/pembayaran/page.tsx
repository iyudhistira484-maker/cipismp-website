import { requireStaff } from "@/server/auth/guard";
import { hasPermission } from "@/server/rbac";
import { loadProviderConfig, PROVIDER_LABEL, type ProviderId } from "@/server/payments";
import { recentWebhookEvents, pendingPaymentRows } from "@/server/admin/queries";
import { getSettings } from "@/server/settings";
import { env } from "@/server/env";
import { formatRp } from "@/lib/money";
import { formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { ProviderForm, TestProvidersButton } from "@/components/admin/admin-forms";

export const metadata = { title: "Pembayaran" };

const WEBHOOK_PATHS: Record<ProviderId, string> = {
  TRIPAY: "/api/webhooks/tripay",
  MIDTRANS: "/api/webhooks/midtrans",
  FAKE: "/api/webhooks/fake",
};

export default async function AdminPaymentsPage() {
  const viewer = await requireStaff("settings.read");
  const canSeeSecrets = hasPermission(viewer.user.role, "payments.secrets");
  const [settings, events, pending] = await Promise.all([getSettings(), recentWebhookEvents(10), pendingPaymentRows(10)]);

  const records = await Promise.all(
    (["TRIPAY", "MIDTRANS", "FAKE"] as ProviderId[]).map(async (provider) => ({
      provider,
      record: await loadProviderConfig(provider),
    })),
  );

  return (
    <>
      <AdminPageHeader
        title="Pembayaran"
        description="Kredensial disimpan terenkripsi di database. Webhook diverifikasi dari payload mentah dan diproses idempoten."
        actions={<TestProvidersButton />}
      />

      <Alert tone="info">
        Toko ini tidak menyediakan refund. Tidak ada tombol atau endpoint refund di panel ini; sengketa ditandai DISPUTED
        dan ditangani manual tanpa mengembalikan dana lewat sistem.
      </Alert>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {records.map(({ provider, record }) => {
          const enabled = record?.enabled ?? settings.payments.enabled[provider];
          return (
            <Card key={provider} title={`${PROVIDER_LABEL[provider]} · webhook`}>
              <p className="mb-3 break-all rounded bg-bg/60 px-2 py-1.5 font-mono text-2xs text-muted">
                {env.APP_URL.replace(/\/$/, "")}
                {WEBHOOK_PATHS[provider]}
              </p>
              {canSeeSecrets ? (
                <ProviderForm
                  provider={provider}
                  label={PROVIDER_LABEL[provider]}
                  mode={record?.mode ?? "sandbox"}
                  enabled={enabled}
                  fields={
                    provider === "TRIPAY"
                      ? [
                          { name: "apiKey", label: "API key", value: record?.config.apiKey ?? "", type: "password" },
                          { name: "privateKey", label: "Private key", value: record?.config.privateKey ?? "", type: "password" },
                          { name: "merchantCode", label: "Merchant code", value: record?.config.merchantCode ?? "" },
                        ]
                      : provider === "MIDTRANS"
                        ? [
                            { name: "serverKey", label: "Server key", value: record?.config.serverKey ?? "", type: "password" },
                            { name: "clientKey", label: "Client key", value: record?.config.clientKey ?? "" },
                          ]
                        : [{ name: "secret", label: "Secret simulasi", value: record?.config.secret ?? "", type: "password", hint: "Minimal 16 karakter; dipakai menghitung HMAC webhook." }]
                  }
                />
              ) : (
                <p className="text-2xs leading-relaxed text-muted-2">
                  Kredensial hanya bisa dilihat dan diubah oleh Owner. Status: {enabled ? "aktif" : "nonaktif"}.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Pembayaran menunggu" description="Termasuk pembayaran kurang yang perlu diverifikasi manual.">
          <Table head={["Order", "Gateway", "Status", "Nominal"]} empty={pending.length === 0}>
            {pending.map((row) => (
              <tr key={row.id}>
                <Td className="text-ink">{row.orderNumber}</Td>
                <Td>{row.provider}</Td>
                <Td>
                  <Badge tone={row.status === "UNDERPAID" ? "warning" : "neutral"}>{row.status}</Badge>
                </Td>
                <Td className="tabular-nums">{formatRp(row.amountIdr)}</Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Webhook terakhir" description="Payload mentah tersimpan untuk audit sengketa.">
          <Table head={["Waktu", "Gateway", "Event", "Signature", "Hasil"]} empty={events.length === 0}>
            {events.map((event) => (
              <tr key={event.id}>
                <Td>{formatDateTimeWIB(event.receivedAt)}</Td>
                <Td>{event.provider}</Td>
                <Td className="max-w-48 truncate text-2xs">{event.eventType}</Td>
                <Td>{event.signatureValid ? <span className="text-success">valid</span> : <span className="text-danger">invalid</span>}</Td>
                <Td className="text-2xs">{event.result ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
