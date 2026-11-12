"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Trash2, RotateCcw, Eye, AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { toJakartaInput } from "@/lib/form-datetime";
import type { CouponTier } from "@/lib/pricing";
import type { PaymentMethodOption } from "@/lib/payment-methods";
import { PRODUCT_ACCENT_CHOICES, PRODUCT_ARTWORK_CHOICES } from "@/lib/product-artwork";
import {
  adminCancelOrderAction,
  adminDeleteProductAction,
  adminRestoreProductAction,
  adminGrantCompAction,
  adminMarkPaidAction,
  adminPreviewTransitionAction,
  adminRedeliverAction,
  adminPromoteCustomerAction,
  adminRegisterStaffMinecraftAction,
  adminRemoveStaffMinecraftAction,
  adminRevokeAllStaffSessionsAction,
  adminRevokeEntitlementAction,
  adminRevokeSessionAction,
  adminRunTransitionAction,
  adminSaveAutomaticDiscountAction,
  adminSaveCouponAction,
  adminSaveOrderNoteAction,
  adminSavePaymentMethodsAction,
  adminSaveProductAction,
  adminSaveProviderAction,
  adminSaveSeasonAction,
  adminSaveServerAction,
  adminSaveDeliverySettingsAction,
  adminSaveSiteSettingsAction,
  adminSaveStoreSettingsAction,
  adminSetRoleAction,
  adminTestProvidersAction,
  adminTestServerAction,
  adminToggleAutomaticDiscountAction,
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
      <label className="max-w-56 text-2xs text-muted-2">
        <input type="checkbox" name="reconciled" value="yes" required className="mr-1" />
        Saya sudah memeriksa hasil di server dan memastikan pengiriman ulang aman.
      </label>
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
  accent: string;
  artwork: string;
  useServerCommands: boolean;
  grantTemplate: string;
  revokeTemplate: string;
  kitItems: string;
}

export function ProductForm({ product }: { product?: ProductFormValues }) {
  const [state, action] = useActionState(adminSaveProductAction, empty);
  const [selectedProductType, setSelectedProductType] = useState(product?.type ?? "RANK");
  const [selectedArtwork, setSelectedArtwork] = useState(() => {
    if (product?.type === "KIT") return "";
    const currentArtwork = product?.artwork ?? "";
    return PRODUCT_ARTWORK_CHOICES.some((choice) => choice.value === currentArtwork) ? currentArtwork : "";
  });
  const defaultGrant = product?.grantTemplate ?? "";
  const defaultRevoke = product?.revokeTemplate ?? "";
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jenis" htmlFor="product-type" required>
          <Select
            id="product-type"
            name="type"
            value={selectedProductType}
            onChange={(event) => {
              const nextType = event.currentTarget.value;
              setSelectedProductType(nextType);
              if (nextType === "KIT") setSelectedArtwork("");
            }}
            required
          >
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
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Slug" htmlFor="product-slug" hint="Dipakai di URL" required>
          <Input id="product-slug" name="slug" defaultValue={product?.slug} required pattern="[a-z0-9-]{3,40}" />
        </Field>
        <Field label="Harga (Rp)" htmlFor="product-price" required>
          <Input id="product-price" name="priceIdr" defaultValue={product?.priceIdr ?? 25000} inputMode="numeric" required />
        </Field>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Tier" htmlFor="product-tier" hint="Rank: makin besar makin tinggi">
          <Input id="product-tier" name="tier" type="number" min={0} max={20} defaultValue={product?.tier ?? 0} />
        </Field>
        <Field label="Warna badge" htmlFor="product-accent">
          <Select id="product-accent" name="accent" defaultValue={product?.accent ?? "amber"}>
            {PRODUCT_ACCENT_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </Select>
        </Field>
        <Field
          label="Ilustrasi kartu"
          htmlFor="product-artwork"
          hint={selectedProductType === "KIT" ? "Kit memakai ikon item Minecraft asli." : "Pilih ilustrasi rank lokal."}
        >
          <Select
            id="product-artwork"
            name="artwork"
            value={selectedProductType === "KIT" ? "" : selectedArtwork}
            onChange={(event) => setSelectedArtwork(event.currentTarget.value)}
          >
            <option value="">
              {selectedProductType === "KIT" ? "Ikon mengikuti isi kit" : "Otomatis dari slug / tanpa gambar khusus"}
            </option>
            {selectedProductType === "KIT"
              ? null
              : PRODUCT_ARTWORK_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
          </Select>
        </Field>
        <Field label="Batas per season" htmlFor="product-max">
          <Input id="product-max" name="maxPerSeason" type="number" min={1} max={50} defaultValue={product?.maxPerSeason ?? 1} />
        </Field>
        <Field
          label="Cooldown pembelian ulang (jam)"
          htmlFor="product-cooldown"
          hint="Bukan cooldown klaim PlayerKits di dalam server; kit Cipi diatur terpisah."
        >
          <Input id="product-cooldown" name="cooldownHours" type="number" min={0} max={720} defaultValue={product?.cooldownHours ?? 0} />
        </Field>
        <Field label="Urutan tampil" htmlFor="product-sort">
          <Input id="product-sort" name="sortOrder" type="number" min={0} max={999} defaultValue={product?.sortOrder ?? 0} />
        </Field>
      </div>
      <CheckboxField
        name="useServerCommands"
        defaultChecked={product?.useServerCommands ?? true}
        label="Jalankan perintah server setelah pembayaran"
        hint="Matikan hanya untuk produk yang memang tidak perlu pengiriman otomatis."
      />
      <Field label="Tagline" htmlFor="product-tagline" required>
        <Input id="product-tagline" name="tagline" defaultValue={product?.tagline} required maxLength={120} />
      </Field>
      <Field label="Deskripsi" htmlFor="product-description" required>
        <Textarea id="product-description" name="description" defaultValue={product?.description} required rows={4} />
      </Field>
      <Field label="Keuntungan (satu per baris)" htmlFor="product-perks">
        <Textarea id="product-perks" name="perks" defaultValue={product?.perks} rows={5} placeholder={"Prefix chat khusus\n3 home tambahan"} />
      </Field>
      <p className="text-2xs leading-relaxed text-warning">
        Pengiriman otomatis hanya menerima perintah LuckPerms parent add/remove untuk vip, mvp, elite, legend,
        atau permission kit cipiprime dan cipi++. Perintah lain, termasuk parent set, ditahan. Gunakan
        {' '}{"{uuid}"} sebagai target bila nama Bedrock mengandung spasi; periksa group dan antrean di staging.
      </p>
      <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Perintah grant" htmlFor="product-grant" hint="Placeholder: {player}, {uuid}, {season}, {rank}, {kitname}">
        <Textarea id="product-grant" name="grantTemplate" defaultValue={defaultGrant} rows={3} spellCheck={false} className="font-mono text-[12px]" />
      </Field>
      <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Perintah revoke" htmlFor="product-revoke" hint="Gunakan # di awal baris untuk komentar. Multi-baris didukung.">
        <Textarea id="product-revoke" name="revokeTemplate" defaultValue={defaultRevoke} rows={3} spellCheck={false} className="font-mono text-[12px]" />
      </Field>
      <Field
        label="Isi kit (khusus jenis Kit)"
        htmlFor="product-kit-items"
        hint="Satu item per baris: item_key | nama | jumlah | enchantment1,enchantment2 | lore1,lore2"
      >
        <Textarea
          id="product-kit-items"
          name="kitItems"
          defaultValue={product?.kitItems}
          rows={5}
          spellCheck={false}
          className="font-mono text-[12px]"
          placeholder={"bread | Roti | 16 | | Makanan pemulihan\nstone_sword | Pedang Batu | 1 | Ketajaman I |"}
        />
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

export function RestoreProductButton({ productId }: { productId: string }) {
  const [state, action] = useActionState(adminRestoreProductAction, empty);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <SubmitButton size="sm" variant="secondary">
        <RotateCcw className="size-3.5" aria-hidden />
        Pulihkan sebagai draft
      </SubmitButton>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
      {state.success ? <span className="text-2xs text-success">{state.success}</span> : null}
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
            defaultValue={toJakartaInput(season?.endAt ?? new Date(Date.now() + 60 * 86_400_000))}
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
        <Select id="transition-season" value={seasonId} disabled={previewing} onChange={(event) => { setSeasonId(event.target.value); setPreview(empty); }}>
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
            Simulasi (tidak mengubah season atau entitlement)
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
  tiers: CouponTier[];
  seasonId: string | null;
  maxRedemptions: number | null;
  maxPerUser: number;
  startsAt: Date | null;
  endsAt: Date | null;
  rankOnly: boolean;
  kitOnly: boolean;
  eligibleItemsOnly: boolean;
  active: boolean;
}

export interface CouponSeasonOption {
  id: string;
  name: string;
  status: string;
}

export function CouponForm({ coupon, seasons }: { coupon?: CouponFormValues; seasons: CouponSeasonOption[] }) {
  const [state, action] = useActionState(adminSaveCouponAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      {coupon?.id ? <input type="hidden" name="id" value={coupon.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kode" htmlFor="coupon-code" required>
          <Input id="coupon-code" name="code" defaultValue={coupon?.code} required placeholder="HEMAT10" />
        </Field>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Season" htmlFor="coupon-season" hint="Kosong = semua season">
          <Select id="coupon-season" name="seasonId" defaultValue={coupon?.seasonId ?? ""}>
            <option value="">Semua season</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name} ({season.status === "ACTIVE" ? "aktif" : season.status === "UPCOMING" ? "akan datang" : "selesai"})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Diskon dasar — tipe" htmlFor="coupon-type" required>
          <Select id="coupon-type" name="type" defaultValue={coupon?.type ?? "PERCENT"}>
            <option value="PERCENT">Persen</option>
            <option value="FIXED">Nominal</option>
          </Select>
        </Field>
        <Field label="Diskon dasar — nilai" htmlFor="coupon-value" required>
          <Input id="coupon-value" name="value" defaultValue={coupon?.value ?? 10} inputMode="numeric" required />
        </Field>
        <Field label="Minimum belanja dasar (Rp)" htmlFor="coupon-min">
          <Input id="coupon-min" name="minSubtotalIdr" defaultValue={coupon?.minSubtotalIdr ?? 0} inputMode="numeric" />
        </Field>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Kuota total" htmlFor="coupon-max" hint="0 = tanpa batas">
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

      <section className="space-y-3 rounded-md border border-line bg-bg/30 p-3" aria-labelledby="coupon-tiers-title">
        <div>
          <h3 id="coupon-tiers-title" className="text-[13px] font-semibold text-ink">Diskon bertingkat</h3>
          <p className="mt-1 text-2xs leading-relaxed text-muted-2">
            Nilai dasar adalah tingkat pertama. Tambahkan ambang belanja lebih tinggi; tingkat tertinggi yang tercapai dipakai, tidak dijumlahkan.
          </p>
        </div>
        {[2, 3].map((tierNumber, index) => {
          const tier = coupon?.tiers[index];
          return (
            <div key={tierNumber} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr]">
              <Field label={`Tingkat ${tierNumber} — minimum (Rp)`} htmlFor={`coupon-tier-${tierNumber}-min`}>
                <Input
                  id={`coupon-tier-${tierNumber}-min`}
                  name={`tier${tierNumber}MinSubtotalIdr`}
                  defaultValue={tier?.minSubtotalIdr ?? ""}
                  inputMode="numeric"
                  placeholder="Kosong = tidak dipakai"
                />
              </Field>
              <Field label="Tipe diskon" htmlFor={`coupon-tier-${tierNumber}-type`}>
                <Select
                  id={`coupon-tier-${tierNumber}-type`}
                  name={`tier${tierNumber}Type`}
                  defaultValue={tier?.type ?? "PERCENT"}
                >
                  <option value="PERCENT">Persen</option>
                  <option value="FIXED">Nominal</option>
                </Select>
              </Field>
              <Field label="Nilai diskon" htmlFor={`coupon-tier-${tierNumber}-value`}>
                <Input
                  id={`coupon-tier-${tierNumber}-value`}
                  name={`tier${tierNumber}Value`}
                  defaultValue={tier?.value ?? ""}
                  inputMode="numeric"
                  placeholder="10 atau 10000"
                />
              </Field>
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" name="active" defaultChecked={coupon?.active ?? true} className="accent-accent" /> Aktif
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" name="rankOnly" defaultChecked={coupon?.rankOnly ?? false} className="accent-accent" /> Keranjang berisi rank
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" name="kitOnly" defaultChecked={coupon?.kitOnly ?? false} className="accent-accent" /> Keranjang berisi kit
        </label>
      </div>
      <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Cakupan potongan" htmlFor="coupon-scope" hint="Minimum belanja dan tingkat kupon selalu memakai subtotal seluruh keranjang. Jika tidak memilih jenis rank/kit, kedua pilihan menghasilkan nilai yang sama.">
        <Select id="coupon-scope" name="discountScope" defaultValue={coupon?.eligibleItemsOnly ? "eligible" : "cart"}>
          <option value="cart">Seluruh keranjang</option><option value="eligible">Hanya jenis yang dipilih</option>
        </Select>
      </Field>
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

export interface AutomaticDiscountFormValues {
  id?: string;
  name: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotalIdr: number;
  seasonId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  rankOnly: boolean;
  kitOnly: boolean;
  eligibleItemsOnly: boolean;
  active: boolean;
}

export function AutomaticDiscountForm({
  discount,
  seasons,
}: {
  discount?: AutomaticDiscountFormValues;
  seasons: CouponSeasonOption[];
}) {
  const [state, action] = useActionState(adminSaveAutomaticDiscountAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      {discount?.id ? <input type="hidden" name="id" value={discount.id} /> : null}
      <Field label="Nama promosi" htmlFor="auto-discount-name" required>
        <Input
          id="auto-discount-name"
          name="name"
          defaultValue={discount?.name}
          minLength={3}
          maxLength={60}
          required
          placeholder="Diskon awal season"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Season" htmlFor="auto-discount-season" hint="Kosong = semua season">
          <Select id="auto-discount-season" name="seasonId" defaultValue={discount?.seasonId ?? ""}>
            <option value="">Semua season</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name} ({season.status === "ACTIVE" ? "aktif" : season.status === "UPCOMING" ? "akan datang" : "selesai"})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Minimum belanja (Rp)" htmlFor="auto-discount-min">
          <Input
            id="auto-discount-min"
            name="minSubtotalIdr"
            defaultValue={discount?.minSubtotalIdr ?? 0}
            inputMode="numeric"
          />
        </Field>
        <Field label="Tipe diskon" htmlFor="auto-discount-type" required>
          <Select id="auto-discount-type" name="type" defaultValue={discount?.type ?? "PERCENT"}>
            <option value="PERCENT">Persen</option>
            <option value="FIXED">Nominal</option>
          </Select>
        </Field>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Nilai diskon" htmlFor="auto-discount-value" required hint="Persen 1–100; nominal min. Rp 1.000">
          <Input
            id="auto-discount-value"
            name="value"
            defaultValue={discount?.value ?? 10}
            inputMode="numeric"
            required
          />
        </Field>
        <Field label="Mulai (WIB)" htmlFor="auto-discount-start">
          <Input
            id="auto-discount-start"
            name="startsAt"
            type="datetime-local"
            defaultValue={discount?.startsAt ? toJakartaInput(discount.startsAt) : ""}
          />
        </Field>
        <Field label="Berakhir (WIB)" htmlFor="auto-discount-end">
          <Input
            id="auto-discount-end"
            name="endsAt"
            type="datetime-local"
            defaultValue={discount?.endsAt ? toJakartaInput(discount.endsAt) : ""}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" name="active" defaultChecked={discount?.active ?? true} className="accent-accent" /> Aktif
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" name="rankOnly" defaultChecked={discount?.rankOnly ?? false} className="accent-accent" /> Keranjang berisi rank
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" name="kitOnly" defaultChecked={discount?.kitOnly ?? false} className="accent-accent" /> Keranjang berisi kit
        </label>
      </div>
      <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Cakupan potongan" htmlFor="auto-discount-scope" hint="Minimum belanja memakai subtotal seluruh keranjang. Jika tidak memilih jenis rank/kit, kedua pilihan menghasilkan nilai yang sama.">
        <Select id="auto-discount-scope" name="discountScope" defaultValue={discount?.eligibleItemsOnly ? "eligible" : "cart"}>
          <option value="cart">Seluruh keranjang</option><option value="eligible">Hanya jenis yang dipilih</option>
        </Select>
      </Field>
      <p className="text-2xs leading-relaxed text-muted-2">
        Tidak memerlukan kode. Kupon dan promo tidak ditumpuk: potongan terbesar dipilih, dan kupon menang jika sama. Total pembayaran harus lebih dari Rp 0.
      </p>
      <SubmitButton size="sm">{discount?.id ? "Simpan diskon" : "Buat diskon"}</SubmitButton>
    </form>
  );
}

export function ToggleAutomaticDiscountButton({ discountId, active }: { discountId: string; active: boolean }) {
  const [state, action] = useActionState(adminToggleAutomaticDiscountAction, empty);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="discountId" value={discountId} />
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
  features: { coupons: boolean; gifting: boolean; reviews: boolean; discordLogin: boolean };
}

export interface SiteSettingsValues {
  name: string;
  tagline: string;
  supportEmail: string;
  discordUrl: string;
  announcement: string | null;
  delivery: { maxAttempts: number; baseDelaySeconds: number; offlineGraceMinutes: number };
}

export function SiteSettingsForm({ settings }: { settings: SiteSettingsValues }) {
  const [state, action] = useActionState(adminSaveSiteSettingsAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama situs" htmlFor="site-name">
          <Input id="site-name" name="siteName" defaultValue={settings.name} maxLength={40} required />
        </Field>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Email bantuan" htmlFor="site-email" hint="Tampil di footer, FAQ, dan halaman bantuan">
          <Input id="site-email" name="supportEmail" type="email" defaultValue={settings.supportEmail} required />
        </Field>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Tagline" htmlFor="site-tagline" hint="Maksimal 160 karakter">
          <Input id="site-tagline" name="siteTagline" defaultValue={settings.tagline} maxLength={160} />
        </Field>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="URL Discord" htmlFor="site-discord" hint="Diawali https:// — boleh dikosongkan">
          <Input id="site-discord" name="discordUrl" defaultValue={settings.discordUrl} maxLength={200} />
        </Field>
      </div>
      <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Pengumuman di atas situs" htmlFor="site-announcement" hint="Kosongkan untuk menyembunyikan banner">
        <Textarea
          id="site-announcement"
          name="announcement"
          defaultValue={settings.announcement ?? ""}
          maxLength={280}
          rows={2}
          className="min-h-16"
        />
      </Field>
      <SubmitButton size="sm">Simpan identitas</SubmitButton>
    </form>
  );
}

export function DeliverySettingsForm({ settings }: { settings: SiteSettingsValues["delivery"] }) {
  const [state, action] = useActionState(adminSaveDeliverySettingsAction, empty);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Percobaan maks" htmlFor="delivery-attempts">
          <Input id="delivery-attempts" name="maxAttempts" type="number" min={1} max={20} defaultValue={settings.maxAttempts} />
        </Field>
        <Field label="Jeda dasar (detik)" htmlFor="delivery-delay">
          <Input id="delivery-delay" name="baseDelaySeconds" type="number" min={15} max={3600} defaultValue={settings.baseDelaySeconds} />
        </Field>
        <Field label="Tunggu offline (menit)" htmlFor="delivery-grace">
          <Input id="delivery-grace" name="offlineGraceMinutes" type="number" min={0} max={1440} defaultValue={settings.offlineGraceMinutes} />
        </Field>
      </div>
      <p className="text-2xs leading-relaxed text-muted-2">
        Jeda percobaan naik eksponensial dari nilai dasar. Setelah percobaan habis, pengiriman menjadi DEAD dan perlu
        tindakan manual di halaman Pengiriman.
      </p>
      <SubmitButton size="sm">Simpan pengiriman</SubmitButton>
    </form>
  );
}

export function StoreSettingsForm({ settings, allowSimulation }: { settings: StoreSettingsValues; allowSimulation: boolean }) {
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
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Usia minimum" htmlFor="settings-age" hint="Minimal 13 tahun">
          <Input id="settings-age" name="minimumAge" type="number" min={13} max={21} defaultValue={settings.minimumAge} />
        </Field>
        <Field label="Freeze default (hari)" htmlFor="settings-freeze">
          <Input id="settings-freeze" name="defaultFreezeDays" type="number" min={0} max={30} defaultValue={settings.defaultFreezeDays} />
        </Field>
        <Field label="Gateway default" htmlFor="settings-provider">
          <Select id="settings-provider" name="defaultProvider" defaultValue={!allowSimulation && settings.defaultProvider === "FAKE" ? "TRIPAY" : settings.defaultProvider}>
            <option value="TRIPAY">Tripay</option>
            <option value="MIDTRANS">Midtrans</option>
            {allowSimulation ? <option value="FAKE">Simulasi (dev)</option> : null}
          </Select>
        </Field>
      </div>
      <CheckboxField id="settings-checkout" name="checkoutEnabled" defaultChecked={settings.checkoutEnabled} label="Checkout dibuka" />

      <fieldset className="rounded-md border border-line bg-surface/40 p-3">
        <legend className="px-1 text-2xs uppercase tracking-wider text-muted-2">Fitur toko</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxField id="feature-coupons" name="featureCoupons" defaultChecked={settings.features.coupons} label="Kupon diskon" />
          <CheckboxField id="feature-gifting" name="featureGifting" defaultChecked={settings.features.gifting} label="Hadiah (gift) rank/kit" />
          <CheckboxField id="feature-reviews" name="featureReviews" defaultChecked={settings.features.reviews} label="Ulasan pembeli" />
          <CheckboxField id="feature-discord" name="featureDiscord" defaultChecked={settings.features.discordLogin} label="Login Discord" />
        </div>
        <p className="mt-2 text-2xs leading-relaxed text-muted-2">
          Login Discord juga memerlukan DISCORD_CLIENT_ID dan DISCORD_CLIENT_SECRET di .env; tombol hanya muncul bila
          keduanya terisi.
        </p>
      </fieldset>

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

export function PaymentMethodsForm({
  tripayMethods,
  midtransMethods,
  tripayOptions,
  midtransOptions,
}: {
  tripayMethods: string[];
  midtransMethods: string[];
  tripayOptions: readonly PaymentMethodOption[];
  midtransOptions: readonly PaymentMethodOption[];
}) {
  const [state, action] = useActionState(adminSavePaymentMethodsAction, empty);

  return (
    <form action={action} className="space-y-4">
      <StateAlert state={state} />
      <div className="grid gap-4 xl:grid-cols-2">
        {([
          { id: "tripay", label: "Tripay", name: "tripayMethods", options: tripayOptions, selected: tripayMethods },
          { id: "midtrans", label: "Midtrans", name: "midtransMethods", options: midtransOptions, selected: midtransMethods },
        ] as const).map((provider) => (
          <fieldset key={provider.id} className="rounded-md border border-line bg-surface/40 p-3">
            <legend className="px-1 text-[13px] font-medium text-ink">{provider.label}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {provider.options.map((option) => (
                <label
                  key={option.code}
                  htmlFor={`payment-method-${provider.id}-${option.code}`}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line/70 bg-bg/40 p-2.5 text-[12.5px] text-muted hover:border-line-strong"
                >
                  <input
                    id={`payment-method-${provider.id}-${option.code}`}
                    type="checkbox"
                    name={provider.name}
                    value={option.code}
                    defaultChecked={provider.selected.includes(option.code)}
                    className="mt-0.5 size-4 shrink-0 accent-accent"
                  />
                  <span className="min-w-0">
                    <span className="block text-ink">{option.label}</span>
                    <span className="text-2xs text-muted-2">{option.group}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="text-2xs leading-relaxed text-muted-2">
        Hanya metode Tripay/Midtrans yang dicentang akan ditawarkan saat checkout. Jika semua metode satu gateway dimatikan,
        gateway itu tidak muncul untuk pembeli. Ketersediaan gateway tetap mengikuti akun penyedia pembayaran.
      </p>
      <SubmitButton size="sm">Simpan metode pembayaran</SubmitButton>
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
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" key={field.name} label={field.label} htmlFor={`${provider}-${field.name}`} hint={field.hint}>
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
            <option value="PLUGIN">Plugin companion (polling HTTPS)</option>
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
        <p className="sm:col-span-2 rounded-md border border-line bg-surface-2/50 p-3 text-2xs leading-relaxed text-muted">
          Plugin Minecraft mengambil antrean dari website melalui HTTPS. Tidak perlu URL plugin publik atau port masuk;
          atur <span className="font-mono">website-url</span> dan <span className="font-mono">shared-secret</span> di config plugin.
          Secret harus sama dengan <span className="font-mono">PLUGIN_SHARED_SECRET</span> di environment website.
        </p>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Host RCON" htmlFor="server-rcon-host" hint="Pada mode offline, pengiriman RCON ditahan. Jangan gunakan untuk melewati antrean plugin.">
          <Input id="server-rcon-host" name="rconHost" defaultValue={server?.rconHost ?? ""} />
        </Field>
        <Field label="Port RCON" htmlFor="server-rcon-port">
          <Input id="server-rcon-port" name="rconPort" type="number" defaultValue={server?.rconPort ?? 25575} />
        </Field>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Password RCON" htmlFor="server-rcon-pass" hint={server?.rconPasswordSet ? "Sudah diatur." : undefined}>
          <Input id="server-rcon-pass" name="rconPassword" type="password" autoComplete="new-password" />
        </Field>
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="URL status API" htmlFor="server-status-url" hint="Opsional, untuk status pemain online">
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

export function StaffMinecraftRegisterForm({ staff }: { staff: Array<{ id: string; username: string; email: string }> }) {
  const [state, action] = useActionState(adminRegisterStaffMinecraftAction, empty);
  useEffect(() => { if (state.success) window.location.reload(); }, [state.success]);
  return (
    <form action={action} className="space-y-3">
      <StateAlert state={state} />
      <Field label="Akun website staf" htmlFor="protected-staff" required>
        <Select id="protected-staff" name="staffUserId" required defaultValue="">
          <option value="" disabled>Pilih staf</option>
          {staff.map((member) => <option key={member.id} value={member.id}>{member.username} — {member.email}</option>)}
        </Select>
      </Field>
      <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="UUID Minecraft" htmlFor="protected-uuid" required hint="Gunakan UUID asli Java atau Floodgate; bukan username.">
        <Input id="protected-uuid" name="uuid" required maxLength={36} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      </Field>
      <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Label akun" htmlFor="protected-label" required hint="Contoh: utama atau alternatif; jangan isi password.">
        <Input id="protected-label" name="label" required maxLength={64} />
      </Field>
      <Field label="Alasan / sumber verifikasi" htmlFor="protected-reason" required>
        <Textarea id="protected-reason" name="reason" required minLength={10} maxLength={500} rows={2} />
      </Field>
      <SubmitButton size="sm">Daftarkan UUID</SubmitButton>
    </form>
  );
}

export function StaffMinecraftRemoveForm({ uuid }: { uuid: string }) {
  const [state, action] = useActionState(adminRemoveStaffMinecraftAction, empty);
  useEffect(() => { if (state.success) window.location.reload(); }, [state.success]);
  return (
    <form action={action} className="space-y-2 min-w-48">
      <input type="hidden" name="uuid" value={uuid} />
      <label className="text-2xs text-muted">Alasan penghapusan (minimal 10 karakter)
        <Input name="reason" required minLength={10} maxLength={500} aria-label={`Alasan hapus ${uuid}`} />
      </label>
      <CheckboxField name="confirmed" required label="Saya sudah memeriksa identitas dan antrean." />
      <SubmitButton size="sm" variant="secondary">Hapus UUID</SubmitButton>
      <StateAlert state={state} />
    </form>
  );
}

export function PromoteCustomerForm({ userId, username, ready }: { userId: string; username: string; ready: boolean }) {
  const [state, action] = useActionState(adminPromoteCustomerAction, empty);
  useEffect(() => { if (state.success) window.location.assign("/admin/staf"); }, [state.success]);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <StateAlert state={state} />
      <Field label="Role website" htmlFor="promotion-role" required>
        <Select id="promotion-role" name="role" required defaultValue="" disabled={!ready}>
          <option value="" disabled>Pilih role</option><option value="ADMIN">Admin</option><option value="SUPPORT">Support</option>
        </Select>
      </Field>
      <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="Alasan dan verifikasi identitas" htmlFor="promotion-reason" required hint="Catat bagaimana identitas dan kebutuhan akses staf diperiksa.">
        <Textarea id="promotion-reason" name="reason" required minLength={10} maxLength={500} rows={2} disabled={!ready} />
      </Field>
      <CheckboxField name="confirmed" required disabled={!ready} label={`Saya sudah memverifikasi ${username} dan memahami hak akses yang diberikan.`} />
      <SubmitButton size="sm" disabled={!ready}>Berikan akses staf</SubmitButton>
    </form>
  );
}

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
        <Field className="[&>div:first-child]:flex-col [&>div:first-child]:items-start [&>div:first-child]:gap-1" label="UUID pemain" htmlFor="comp-uuid" hint="Java/Floodgate UUID" required>
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
