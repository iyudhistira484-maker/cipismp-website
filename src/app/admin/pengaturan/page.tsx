import { requireStaff } from "@/server/auth/guard";
import { getSettings } from "@/server/settings";
import { getAvailableProviders, PROVIDER_LABEL, type ProviderId } from "@/server/payments";
import { hasPermission } from "@/server/rbac";
import { env } from "@/server/env";
import { AdminPageHeader, Card } from "@/components/admin/shell";
import {
  DeliverySettingsForm,
  SiteSettingsForm,
  StoreSettingsForm,
} from "@/components/admin/admin-forms";
import { Alert } from "@/components/ui/feedback";

export const metadata = { title: "Pengaturan toko" };

export default async function AdminStoreSettingsPage() {
  const viewer = await requireStaff("settings.write");
  const canSeeProviderReadiness = hasPermission(viewer.user.role, "payments.secrets");
  const [settings, providers] = await Promise.all([
    getSettings(),
    canSeeProviderReadiness ? getAvailableProviders() : Promise.resolve(null),
  ]);
  const enabledProviders: ProviderId[] = (["TRIPAY", "MIDTRANS", "FAKE"] as ProviderId[]).filter(
    (provider) => settings.payments.enabled[provider] && (provider !== "FAKE" || env.NODE_ENV !== "production"),
  );

  return (
    <>
      <AdminPageHeader
        title="Pengaturan toko"
        description="Perubahan berlaku langsung setelah disimpan dan tercatat di audit log."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Pajak, biaya, dan fitur">
            <StoreSettingsForm
              settings={{
                taxPercent: settings.store.taxPercent,
                taxLabel: settings.store.taxLabel,
                feeMode: settings.store.feeMode,
                feeFlatIdr: settings.store.feeFlatIdr,
                feePercent: settings.store.feePercent,
                orderExpiryMinutes: settings.store.orderExpiryMinutes,
                checkoutEnabled: settings.store.checkoutEnabled,
                minimumAge: settings.store.minimumAge,
                defaultFreezeDays: settings.store.defaultFreezeDays,
                defaultProvider: settings.payments.defaultProvider,
                features: settings.features,
              }}
            />
          </Card>

          <Card title="Identitas situs & pengumuman">
            <SiteSettingsForm
              settings={{
                name: settings.site.name,
                tagline: settings.site.tagline,
                supportEmail: settings.site.supportEmail,
                discordUrl: settings.site.discordUrl,
                announcement: settings.site.announcement,
                delivery: settings.delivery,
              }}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Pengiriman & percobaan ulang">
            <DeliverySettingsForm settings={settings.delivery} />
          </Card>

          <Card title={providers === null ? "Gateway diaktifkan" : "Gateway siap pakai"}>
            {providers === null ? (
              enabledProviders.length === 0 ? (
                <Alert tone="warning">Belum ada gateway yang diaktifkan.</Alert>
              ) : (
                <ul className="space-y-1.5 text-[12.5px] text-muted">
                  {enabledProviders.map((provider) => (
                    <li key={provider} className="flex items-center justify-between gap-2">
                      <span className="text-ink">{PROVIDER_LABEL[provider]}</span>
                      <span className="text-2xs text-muted-2">diaktifkan</span>
                    </li>
                  ))}
                </ul>
              )
            ) : providers.length === 0 ? (
              <Alert tone="warning">
                Belum ada gateway yang siap dipakai. Periksa kredensial dan status aktif.
              </Alert>
            ) : (
              <ul className="space-y-1.5 text-[12.5px] text-muted">
                {providers.map((provider) => (
                  <li key={provider.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink">{PROVIDER_LABEL[provider.id]}</span>
                    <span className="text-2xs text-muted-2">
                      {provider.mode} · {provider.methods.length} metode
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-2xs leading-relaxed text-muted-2">
              {providers === null
                ? "Status ini hanya menunjukkan toggle. Owner dapat menguji kesiapan gateway di halaman Pembayaran; kredensial tetap Owner-only."
                : <>Kredensial diatur di halaman Pembayaran. Mode <span className="font-mono">live</span> mengirim transaksi sungguhan — uji dulu dengan nominal kecil.</>}
            </p>
          </Card>

          <Card title="Kebijakan toko">
            <dl className="space-y-2 text-[12.5px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Refund</dt>
                <dd className="text-danger">Tidak tersedia</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Usia minimum</dt>
                <dd className="text-ink">{settings.store.minimumAge} tahun</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Batas bayar</dt>
                <dd className="text-ink">
                  {settings.store.orderExpiryMinutes} menit
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Freeze season</dt>
                <dd className="text-ink">
                  {settings.store.defaultFreezeDays} hari terakhir
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Versi dokumen legal</dt>
                <dd className="text-ink">
                  ToS {settings.legal.tosVersion} · Privasi{" "}
                  {settings.legal.privacyVersion}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-2xs leading-relaxed text-muted-2">
              URL publik: <span className="font-mono">{env.APP_URL}</span>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
