"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2, RotateCcw, Eye, AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { toJakartaInput } from "@/lib/form-datetime";
import {
  adminCancelOrderAction,
  adminDeleteProductAction,
  adminGrantCompAction,
  adminMarkPaidAction,
  adminPreviewTransitionAction,
  adminRedeliverAction,
  adminRevokeAllStaffSessionsAction,
  adminRevokeEntitlementAction,
  adminRevokeSessionAction,
  adminRunTransitionAction,
  adminSaveCouponAction,
  adminSaveOrderNoteAction,
  adminSaveProductAction,
  adminSaveProviderAction,
  adminSaveSeasonAction,
  adminSaveServerAction,
  adminSaveStoreSettingsAction,
  adminSetRoleAction,
  adminTestProvidersAction,
  adminTestServerAction,
  adminToggleCouponAction,
  type AdminState,
} from "@/app/actions/admin";

const empty: AdminState = {};

function StateAlert({ state }: { state: AdminState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

/* ------------------------------------------------------------------ order */

export function OrderAdminActions({ orderId, status }: { orderId: string; status: string }) {
  const [paidState, paidAction] = useActionState(adminMarkPaidAction, empty);
  const [cancelState, cancelAction] = useActionState(adminCancelOrderAction, empty);
  const [noteState, noteAction] = useActionState(adminSaveOrderNoteAction, empty);
  const canMarkPaid = status === "PENDING" || status === "EXPIRED";
  const canCancel = status === "PENDING" || status === "EXPIRED";

  return (
    <div className="space-y-4">
      {canMarkPaid ? (
        <form action={paidAction} className="space-y-2 rounded-md border border-line bg-surface/60 p-3.5">
          <p className="text-[13px] font-medium text-ink">Tandai lunas manual</p>
          <p className="text-2xs leading-relaxed text-muted-2">
            Hanya untuk pembayaran yang sudah terverifikasi di dashboard gateway. Tindakan ini tercatat di audit log.
          </p>
          <StateAlert state={paidState} />
          <input type="hidden" name="orderId" value={orderId} />
          <Field label="Alasan" htmlFor={`paid-reason-${orderId}`} required>
            <Input id={`paid-reason-${orderId}`} name="reason" required placeholder="Transfer manual terverifikasi, ref BCA-123" />
          </Field>
          <SubmitButton size="sm">Tandai lunas</SubmitButton>
        </form>
      ) : null}

      {canCancel ? (
        <form action={cancelAction} className="space-y-2 rounded-md border border-line bg-surface/60 p-3.5">
          <p className="text-[13px] font-medium text-ink">Batalkan order</p>
          <StateAlert state={cancelState} />
          <input type="hidden" name="orderId" value={orderId} />
          <Field label="Alasan pembatalan" htmlFor={`cancel-reason-${orderId}`} required>
            <Input id={`cancel-reason-${orderId}`} name="reason" required placeholder="Pembeli meminta batal sebelum bayar" />
          </Field>
          <SubmitButton size="sm" variant="secondary">Batalkan order</SubmitButton>
        </form>
      ) : null}

      <form action={noteAction} className="space-y-2 rounded-md border border-line bg-surface/60 p-3.5">
        <p className="text-[13px] font-medium text-ink">Catatan internal</p>
        <StateAlert state={noteState} />
        <input type="hidden" name="orderId" value={orderId} />
        <Textarea name="adminNote" placeholder="Catatan untuk tim, tidak terlihat pembeli." rows={3} />
        <SubmitButton size="sm" variant="secondary">Simpan catatan</SubmitButton>
      </form>
    </div>
  );
}

export function RedeliverButton({ deliveryId, label = "Kirim ulang" }: { deliveryId: string; label?: string }) {
  const [state, action, pending] = useActionState(adminRedeliverAction, empty);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <SubmitButton size="sm" variant="secondary" loading={pending}>
        <RotateCcw className="size-3.5" aria-hidden />
        {label}
      </SubmitButton>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
      {state.success ? <span className="text-2xs text-success">{state.success}</span> : null}
    </form>
  );
}

/* ---------------------------------------------------------------- produk */

export interface ProductFormValues {
  id?: string;
  type: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  priceIdr: number;
  tier: number;
  maxPerSeason: number;
  cooldownHours: number;
  sortOrder: number;
  perks: string;
  status: string;
}

export function ProductForm({ product }: { product?: ProductFormValues }) {
  const [state, action] = useActionState(adminSaveProductAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jenis" htmlFor="product-type" required>
          <Select id="product-type" name="type" defaultValue={product?.type ?? "RANK"} required>
            <option value="RANK">Rank</option>
            <option value="KIT">Kit</option>
          </Select>
        </Field>
        <Field label="Status" htmlFor="product-status" required>
          <Select id="product-status" name="status" defaultValue={product?.status ?? "DRAFT"} required>
            <option value="DRAFT">Draft (tidak tampil)</option>
            <option value="PUBLISHED">Published</option>
          </Select>
        </Field>
        <Field label="Nama" htmlFor="product-name" required>
          <Input id="product-name" name="name" defaultValue={product?.name} required maxLength={40} />
        </Field>
        <Field label="Slug" htmlFor="product-slug" hint="Dipakai di URL" required>
          <Input id="product-slug" name="slug" defaultValue={product?.slug} required pattern="[a-z0-9-]{3,40}" />
        </Field>
        <Field label="Harga (Rp)" htmlFor="product-price" required>
          <Input id="product-price" name="priceIdr" defaultValue={product?.priceIdr ?? 25000} inputMode="numeric" required />
        </Field>
        <Field label="Tier" htmlFor="product-tier" hint="Rank: makin besar makin tinggi">
          <Input id="product-tier" name="tier" type="number" min={0} max={20} defaultValue={product?.tier ?? 0} />
        </Field>
        <Field label="Batas per season" htmlFor="product-max">
          <Input id="product-max" name="maxPerSeason" type="number" min={1} max={50} defaultValue={product?.maxPerSeason ?? 1} />
        </Field>
        <Field label="Cooldown (jam)" htmlFor="product-cooldown">
          <Input id="product-cooldown" name="cooldownHours" type="number" min={0} max={720} defaultValue={product?.cooldownHours ?? 0} />
        </Field>
        <Field label="Urutan tampil" htmlFor="product-sort">
          <Input id="product-sort" name="sortOrder" type="number" min={0} max={999} defaultValue={product?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field label="Tagline" htmlFor="product-tagline" required>
        <Input id="product-tagline" name="tagline" defaultValue={product?.tagline} required maxLength={120} />
      </Field>
      <Field label="Deskripsi" htmlFor="product-description" required>
        <Textarea id="product-description" name="description" defaultValue={product?.description} required rows={4} />
      </Field>
      <Field label="Keuntungan (satu per baris)" htmlFor="product-perks">
        <Textarea id="product-perks" name="perks" defaultValue={product?.perks} rows={5} placeholder={"/fly di lobby\n2 home tambahan"} />
      </Field>
      <SubmitButton size="sm">{product?.id ? "Simpan perubahan" : "Buat produk"}</SubmitButton>
    </form>
  );
}

export function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  const [state, action] = useActionState(adminDeleteProductAction, empty);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Sembunyikan produk ${name}? Riwayat order tetap disimpan.`)) event.preventDefault();
      }}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="productId" value={productId} />
      <SubmitButton size="sm" variant="ghost" aria-label={`Sembunyikan ${name}`}>
        <Trash2 className="size-3.5" aria-hidden />
      </SubmitButton>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
    </form>
  );
}

/* ---------------------------------------------------------------- season */

export interface SeasonFormValues {
  id?: string;
  name: string;
  slug: string;
  startAt: Date;
  endAt: Date;
  freezeDays: number;
  status: string;
  notes: string | null;
}

export function SeasonForm({ season }: { season?: SeasonFormValues }) {
  const [state, action] = useActionState(adminSaveSeasonAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      {season?.id ? <input type="hidden" name="id" value={season.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama season" htmlFor="season-name" required>
          <Input id="season-name" name="name" defaultValue={season?.name} required />
        </Field>
        <Field label="Slug" htmlFor="season-slug" required>
          <Input id="season-slug" name="slug" defaultValue={season?.slug} required pattern="[a-z0-9-]{3,40}" />
        </Field>
        <Field label="Mulai (WIB)" htmlFor="season-start" required>
          <Input
            id="season-start"
            name="startAt"
            type="datetime-local"
            defaultValue={toJakartaInput(season?.startAt ?? new Date())}
            required
          />
        </Field>
        <Field label="Selesai (WIB)" htmlFor="season-end" required>
          <Input
            id="season-end"
            name="endAt"
            type="datetime-local"
            defaultValue={toJakartaInput(season?.endAt ?? new Date(Date.now() + 90 * 86_400_000))}
            required
          />
        </Field>
        <Field label="Freeze pembelian (hari terakhir)" htmlFor="season-freeze">
          <Input id="season-freeze" name="freezeDays" type="number" min={0} max={30} defaultValue={season?.freezeDays ?? 3} />
        </Field>
        <Field label="Status" htmlFor="season-status" required>
          <Select id="season-status" name="status" defaultValue={season?.status ?? "UPCOMING"} required>
            <option value="UPCOMING">Upcoming</option>
            <option value="ACTIVE">Active</option>
            <option value="ENDED">Ended</option>
          </Select>
        </Field>
      </div>
      <Field label="Catatan internal" htmlFor="season-notes">
        <Textarea id="season-notes" name="notes" defaultValue={season?.notes ?? ""} rows={2} />
      </Field>
      <p className="text-2xs leading-relaxed text-muted-2">
        Rank dan kit otomatis berakhir saat season berakhir. Mengakhiri season sebaiknya lewat panel transisi
        di bawah agar entitlement dicabut dan dampaknya terlihat lebih dulu.
      </p>
      <SubmitButton size="sm">{season?.id ? "Simpan season" : "Buat season"}</SubmitButton>
    </form>
  );
}

export function SeasonTransitionPanel({ seasons }: { seasons: Array<{ id: string; name: string; status: string; endAt: string }> }) {
  const [state, action] = useActionState(adminRunTransitionAction, empty);
  const [preview, setPreview] = useState<AdminState>(empty);
  const [previewing, startPreview] = useTransition();
  const [seasonId, setSeasonId] = useState(seasons.find((s) => s.status === "ACTIVE")?.id ?? seasons[0]?.id ?? "");
  const [mode, setMode] = useState<"dry-run" | "run">("dry-run");

  return (
    <div className="space-y-3">
      <StateAlert state={state} />
      <Field label="Season yang diakhiri" htmlFor="transition-season">
        <Select id="transition-season" value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name} — {season.status} (selesai {new Date(season.endAt).toLocaleDateString("id-ID")})
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={previewing}
          onClick={() =>
            startPreview(async () => {
              const data = new FormData();
              data.set("seasonId", seasonId);
              setPreview(await adminPreviewTransitionAction(empty, data));
            })
          }
        >
          <Eye className="size-3.5" aria-hidden />
          Pratinjau dampak
        </Button>
      </div>

      {preview.error ? <Alert tone="danger">{preview.error}</Alert> : null}
      {preview.data ? (
        <div className="rounded-md border border-line bg-surface/60 p-3.5 text-[12.5px] text-muted">
          <p>
            <span className="text-ink">{String(preview.data.season)}</span>: {String(preview.data.activeEntitlements)} entitlement aktif
            milik {String(preview.data.players)} pemain akan dicabut.
          </p>
          <p className="mt-1">
            Season berikutnya: <span className="text-ink">{String(preview.data.nextSeason ?? "belum ada")}</span>
          </p>
          {preview.data.canTransition === false ? (
            <p className="mt-1 flex items-center gap-1.5 text-warning">
              <AlertTriangle className="size-3.5" aria-hidden /> {String(preview.data.reason ?? "Transisi belum bisa dijalankan.")}
            </p>
          ) : null}
        </div>
      ) : null}

      <form action={action} className="space-y-2 rounded-md border border-danger/25 bg-danger/[0.04] p-3.5">
        <input type="hidden" name="seasonId" value={seasonId} />
        <p className="text-[13px] font-medium text-ink">Jalankan transisi</p>
        <p className="text-2xs leading-relaxed text-muted-2">
          Semua rank/kit season ini berakhir dan tidak bisa dipulihkan. Tidak ada refund. Jalankan simulasi dulu.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input
              type="radio"
              name="mode"
              value="dry-run"
              checked={mode === "dry-run"}
              onChange={() => setMode("dry-run")}
              className="accent-accent"
            />
            Simulasi (tidak mengubah data)
          </label>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input type="radio" name="mode" value="run" checked={mode === "run"} onChange={() => setMode("run")} className="accent-accent" />
            Eksekusi sungguhan
          </label>
        </div>
        {mode === "run" ? (
          <Field label='Ketik "AKHIRI SEASON"' htmlFor="transition-confirm" required>
            <Input id="transition-confirm" name="confirm" required placeholder="AKHIRI SEASON" />
          </Field>
        ) : null}
        <Field label="Alasan" htmlFor="transition-reason" required>
          <Input id="transition-reason" name="reason" required placeholder="Season 1 selesai sesuai jadwal" />
        </Field>
        <SubmitButton size="sm" variant={mode === "run" ? "danger" : "secondary"}>
          {mode === "run" ? "Akhiri season sekarang" : "Jalankan simulasi"}
        </SubmitButton>
      </form>
    </div>
  );
}

/* ----------------------------------------------------------------- kupon */

export interface CouponFormValues {
  id?: string;
  code: string;
  type: string;
  value: number;
  minSubtotalIdr: number;
  maxRedemptions: number | null;
  maxPerUser: number;
  startsAt: Date | null;
  endsAt: Date | null;
  rankOnly: boolean;
  kitOnly: boolean;
  active: boolean;
}

export function CouponForm({ coupon }: { coupon?: CouponFormValues }) {
  const [state, action] = useActionState(adminSaveCouponAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      {coupon?.id ? <input type="hidden" name="id" value={coupon.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kode" htmlFor="coupon-code" required>
          <Input id="coupon-code" name="code" defaultValue={coupon?.code} required placeholder="HEMAT10" />
        </Field>
        <Field label="Tipe" htmlFor="coupon-type" required>
          <Select id="coupon-type" name="type" defaultValue={coupon?.type ?? "PERCENT"}>
            <option value="PERCENT">Persen</option>
            <option value="FIXED">Nominal</option>
          </Select>
        </Field>
        <Field label="Nilai (persen atau Rp)" htmlFor="coupon-value" required>
          <Input id="coupon-value" name="value" defaultValue={coupon?.value ?? 10} inputMode="numeric" required />
        </Field>
        <Field label="Minimum belanja (Rp)" htmlFor="coupon-min">
          <Input id="coupon-min" name="minSubtotalIdr" defaultValue={coupon?.minSubtotalIdr ?? 0} inputMode="numeric" />
        </Field>
        <Field label="Kuota total" htmlFor="coupon-max" hint="0 = tanpa batas">
          <Input id="coupon-max" name="maxRedemptions" type="number" min={0} defaultValue={coupon?.maxRedemptions ?? 0} />
        </Field>
        <Field label="Batas per pembeli" htmlFor="coupon-per-user">
          <Input id="coupon-per-user" name="maxPerUser" type="number" min={0} defaultValue={coupon?.maxPerUser ?? 1} />
        </Field>
        <Field label="Mulai (WIB)" htmlFor="coupon-start">
          <Input
            id="coupon-start"
            name="startsAt"
            type="datetime-local"
            defaultValue={coupon?.startsAt ? toJakartaInput(coupon.startsAt) : ""}
          />
        </Field>
        <Field label="Berakhir (WIB)" htmlFor="coupon-end">
          <Input id="coupon-end" name="endsAt" type="datetime-local" defaultValue={coupon?.endsAt ? toJakartaInput(coupon.endsAt) : ""} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" name="active" defaultChecked={coupon?.active ?? true} className="accent-accent" /> Aktif
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" name="rankOnly" defaultChecked={coupon?.rankOnly ?? false} className="accent-accent" /> Hanya rank
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" name="kitOnly" defaultChecked={coupon?.kitOnly ?? false} className="accent-accent" /> Hanya kit
        </label>
      </div>
      <SubmitButton size="sm">{coupon?.id ? "Simpan kupon" : "Buat kupon"}</SubmitButton>
    </form>
  );
}

export function ToggleCouponButton({ couponId, active }: { couponId: string; active: boolean }) {
  const [state, action] = useActionState(adminToggleCouponAction, empty);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="couponId" value={couponId} />
      <SubmitButton size="sm" variant="ghost">
        {active ? "Nonaktifkan" : "Aktifkan"}
      </SubmitButton>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
    </form>
  );
}

/* -------------------------------------------------------------- pengaturan */

export interface StoreSettingsValues {
  taxPercent: number;
  taxLabel: string;
  feeMode: string;
  feeFlatIdr: number;
  feePercent: number;
  orderExpiryMinutes: number;
  checkoutEnabled: boolean;
  minimumAge: number;
  defaultFreezeDays: number;
  defaultProvider: string;
}

export function StoreSettingsForm({ settings }: { settings: StoreSettingsValues }) {
  const [state, action] = useActionState(adminSaveStoreSettingsAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="PPN (%)" htmlFor="settings-tax">
          <Input id="settings-tax" name="taxPercent" type="number" min={0} max={30} step="0.1" defaultValue={settings.taxPercent} />
        </Field>
        <Field label="Label pajak" htmlFor="settings-tax-label">
          <Input id="settings-tax-label" name="taxLabel" defaultValue={settings.taxLabel} maxLength={20} />
        </Field>
        <Field label="Mode biaya gateway" htmlFor="settings-fee-mode">
          <Select id="settings-fee-mode" name="feeMode" defaultValue={settings.feeMode}>
            <option value="absorb">Ditanggung toko</option>
            <option value="pass">Dibebankan ke pembeli</option>
          </Select>
        </Field>
        <Field label="Biaya tetap (Rp)" htmlFor="settings-fee-flat">
          <Input id="settings-fee-flat" name="feeFlatIdr" defaultValue={settings.feeFlatIdr} inputMode="numeric" />
        </Field>
        <Field label="Biaya persen (%)" htmlFor="settings-fee-percent">
          <Input id="settings-fee-percent" name="feePercent" type="number" min={0} max={10} step="0.1" defaultValue={settings.feePercent} />
        </Field>
        <Field label="Batas bayar (menit)" htmlFor="settings-expiry">
          <Input id="settings-expiry" name="orderExpiryMinutes" type="number" min={5} max={1440} defaultValue={settings.orderExpiryMinutes} />
        </Field>
        <Field label="Usia minimum" htmlFor="settings-age" hint="Minimal 13 tahun">
          <Input id="settings-age" name="minimumAge" type="number" min={13} max={21} defaultValue={settings.minimumAge} />
        </Field>
        <Field label="Freeze default (hari)" htmlFor="settings-freeze">
          <Input id="settings-freeze" name="defaultFreezeDays" type="number" min={0} max={30} defaultValue={settings.defaultFreezeDays} />
        </Field>
        <Field label="Gateway default" htmlFor="settings-provider">
          <Select id="settings-provider" name="defaultProvider" defaultValue={settings.defaultProvider}>
            <option value="TRIPAY">Tripay</option>
            <option value="MIDTRANS">Midtrans</option>
            <option value="FAKE">Simulasi (dev)</option>
          </Select>
        </Field>
      </div>
      <CheckboxField id="settings-checkout" name="checkoutEnabled" defaultChecked={settings.checkoutEnabled} label="Checkout dibuka" />
      <SubmitButton size="sm">Simpan pengaturan</SubmitButton>
    </form>
  );
}

export function TestProvidersButton() {
  const [state, action] = useActionState(adminTestProvidersAction, empty);
  return (
    <form action={action} className="space-y-2">
      <StateAlert state={state} />
      <SubmitButton size="sm" variant="secondary">Uji gateway siap pakai</SubmitButton>
    </form>
  );
}

export function ProviderForm({
  provider,
  label,
  mode,
  enabled,
  fields,
}: {
  provider: string;
  label: string;
  mode: string;
  enabled: boolean;
  fields: Array<{ name: string; label: string; value: string; type?: "text" | "password"; hint?: string }>;
}) {
  const [state, action] = useActionState(adminSaveProviderAction, empty);
  return (
    <form action={action} className="space-y-3 rounded-md border border-line bg-surface/60 p-3.5">
      <input type="hidden" name="provider" value={provider} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <span className="text-2xs text-muted-2">{mode === "live" ? "LIVE" : "Sandbox"}</span>
      </div>
      <StateAlert state={state} />
      {fields.map((field) => (
        <Field key={field.name} label={field.label} htmlFor={`${provider}-${field.name}`} hint={field.hint}>
          <Input
            id={`${provider}-${field.name}`}
            name={field.name}
            type={field.type ?? "text"}
            defaultValue={field.value}
            autoComplete="off"
          />
        </Field>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mode" htmlFor={`${provider}-mode`}>
          <Select id={`${provider}-mode`} name="mode" defaultValue={mode}>
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </Select>
        </Field>
        <label className="flex items-end gap-2 pb-2.5 text-[13px] text-muted">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="accent-accent" /> Aktif
        </label>
      </div>
      <SubmitButton size="sm" variant="secondary">Simpan {label}</SubmitButton>
    </form>
  );
}

export interface ServerFormValues {
  name: string;
  javaHost: string;
  javaPort: number;
  bedrockHost: string;
  bedrockPort: number;
  deliveryMode: string;
  pluginBaseUrl: string | null;
  pluginSecretSet: boolean;
  rconHost: string | null;
  rconPort: number | null;
  rconPasswordSet: boolean;
  statusApiUrl: string | null;
}

export function ServerSettingsForm({ server }: { server?: ServerFormValues }) {
  const [state, action] = useActionState(adminSaveServerAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama server" htmlFor="server-name" required>
          <Input id="server-name" name="name" defaultValue={server?.name ?? "CipiSMP"} required />
        </Field>
        <Field label="Metode pengiriman" htmlFor="server-mode" required>
          <Select id="server-mode" name="deliveryMode" defaultValue={server?.deliveryMode ?? "PLUGIN"}>
            <option value="PLUGIN">Plugin companion</option>
            <option value="RCON">RCON</option>
          </Select>
        </Field>
        <Field label="Host Java" htmlFor="server-java-host" required>
          <Input id="server-java-host" name="javaHost" defaultValue={server?.javaHost ?? "play.cipismp.my.id"} required />
        </Field>
        <Field label="Port Java" htmlFor="server-java-port" required>
          <Input id="server-java-port" name="javaPort" type="number" defaultValue={server?.javaPort ?? 25565} required />
        </Field>
        <Field label="Host Bedrock" htmlFor="server-bedrock-host" required>
          <Input id="server-bedrock-host" name="bedrockHost" defaultValue={server?.bedrockHost ?? "bedrock.cipismp.my.id"} required />
        </Field>
        <Field label="Port Bedrock" htmlFor="server-bedrock-port" required>
          <Input id="server-bedrock-port" name="bedrockPort" type="number" defaultValue={server?.bedrockPort ?? 19202} required />
        </Field>
        <Field label="URL plugin" htmlFor="server-plugin-url" hint="Alamat plugin di jaringan internal">
          <Input id="server-plugin-url" name="pluginBaseUrl" defaultValue={server?.pluginBaseUrl ?? ""} placeholder="http://10.0.0.5:8081" />
        </Field>
        <Field
          label="Secret plugin"
          htmlFor="server-plugin-secret"
          hint={server?.pluginSecretSet ? "Sudah diatur. Kosongkan bila tidak diubah." : "Sama dengan PLUGIN_SHARED_SECRET"}
        >
          <Input id="server-plugin-secret" name="pluginSecret" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Host RCON" htmlFor="server-rcon-host" hint="Cadangan bila plugin mati">
          <Input id="server-rcon-host" name="rconHost" defaultValue={server?.rconHost ?? ""} />
        </Field>
        <Field label="Port RCON" htmlFor="server-rcon-port">
          <Input id="server-rcon-port" name="rconPort" type="number" defaultValue={server?.rconPort ?? 25575} />
        </Field>
        <Field label="Password RCON" htmlFor="server-rcon-pass" hint={server?.rconPasswordSet ? "Sudah diatur." : undefined}>
          <Input id="server-rcon-pass" name="rconPassword" type="password" autoComplete="new-password" />
        </Field>
        <Field label="URL status API" htmlFor="server-status-url" hint="Opsional, untuk status pemain online">
          <Input id="server-status-url" name="statusApiUrl" defaultValue={server?.statusApiUrl ?? ""} />
        </Field>
      </div>
      <SubmitButton size="sm">Simpan server</SubmitButton>
    </form>
  );
}

export function TestServerButton({ target, label }: { target: "plugin" | "rcon"; label: string }) {
  const [state, action] = useActionState(adminTestServerAction, empty);
  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="target" value={target} />
      <SubmitButton size="sm" variant="secondary">{label}</SubmitButton>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
      {state.success ? <span className="text-2xs text-success">{state.success}</span> : null}
    </form>
  );
}

/* -------------------------------------------------------------------- staf */

export function StaffRoleForm({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: string;
  disabled?: boolean;
}) {
  const [state, action] = useActionState(adminSetRoleAction, empty);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Select name="role" defaultValue={role} className="h-9 w-32 text-[13px]" disabled={disabled} aria-label="Role staf">
        <option value="SUPPORT">Support</option>
        <option value="ADMIN">Admin</option>
        <option value="CUSTOMER">Cabut akses</option>
      </Select>
      <SubmitButton size="sm" variant="secondary" disabled={disabled}>
        Ubah
      </SubmitButton>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
      {state.success ? <span className="text-2xs text-success">{state.success}</span> : null}
    </form>
  );
}

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(adminRevokeSessionAction, empty);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Cabut sesi ini? Perangkat tersebut harus login ulang + 2FA.")) event.preventDefault();
      }}
      className="inline-flex flex-col gap-1"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton size="sm" variant="ghost" loading={pending}>
        Cabut
      </SubmitButton>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
      {state.success ? <span className="text-2xs text-success">{state.success}</span> : null}
    </form>
  );
}

export function RevokeAllSessionsButton({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(adminRevokeAllStaffSessionsAction, empty);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Cabut SEMUA sesi staf ini? Mereka harus login ulang.")) event.preventDefault();
      }}
      className="inline-flex flex-col gap-1"
    >
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton size="sm" variant="ghost" loading={pending} disabled={disabled}>
        Cabut semua sesi
      </SubmitButton>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
      {state.success ? <span className="text-2xs text-success">{state.success}</span> : null}
    </form>
  );
}

/* -------------------------------------------------------------------- comp */

export function CompForm({ products }: { products: Array<{ id: string; name: string; type: string }> }) {
  const [state, action] = useActionState(adminGrantCompAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      <Field label="Produk" htmlFor="comp-product" required>
        <Select id="comp-product" name="productId" required>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.type === "RANK" ? "rank" : "kit"})
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="UUID pemain" htmlFor="comp-uuid" hint="Java/Floodgate UUID" required>
          <Input id="comp-uuid" name="uuid" required placeholder="069a79f4-44e9-4726-a5be-fca90e38aaf5" />
        </Field>
        <Field label="Nama pemain" htmlFor="comp-name" required>
          <Input id="comp-name" name="playerName" required maxLength={16} />
        </Field>
      </div>
      <Field label="Alasan (masuk audit log)" htmlFor="comp-reason" required>
        <Textarea id="comp-reason" name="reason" required rows={2} placeholder="Kompensasi downtime server 12 Nov" />
      </Field>
      <SubmitButton size="sm">Berikan comp</SubmitButton>
    </form>
  );
}

export function RevokeEntitlementButton({ entitlementId }: { entitlementId: string }) {
  const [state, action] = useActionState(adminRevokeEntitlementAction, empty);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const reason = window.prompt("Alasan pencabutan (masuk audit log):");
        if (!reason || reason.trim().length < 5) {
          event.preventDefault();
          return;
        }
        (event.currentTarget.elements.namedItem("reason") as HTMLInputElement).value = reason;
      }}
      className="inline-flex items-center gap-1"
    >
      <input type="hidden" name="entitlementId" value={entitlementId} />
      <input type="hidden" name="reason" defaultValue="" />
      <SubmitButton size="sm" variant="ghost">Cabut</SubmitButton>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
    </form>
  );
}
