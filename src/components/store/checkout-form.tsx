"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Loader2, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, CheckboxField } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { checkoutAction, type CheckoutState } from "@/app/actions/checkout";
import { previewTotalsAction, type PreviewResult } from "@/app/actions/preview";
import { formatRp } from "@/lib/money";
import { formatDateWIB } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface ProviderOption {
  id: "TRIPAY" | "MIDTRANS" | "FAKE";
  label: string;
  mode: "sandbox" | "live";
  methods: Array<{ code: string; label: string; group: string }>;
}

interface LookupResult {
  uuid: string;
  name: string;
  edition: "JAVA" | "BEDROCK";
  headUrl: string;
}

const initialState: CheckoutState = {};

export function CheckoutForm({
  providers,
  defaultProviderId,
  items,
  season,
  defaults,
  signedIn,
  couponsEnabled,
  taxPercent,
  taxLabel,
  minimumAge,
  frozen,
}: {
  providers: ProviderOption[];
  defaultProviderId: string | null;
  items: Array<{ productId: string; name: string; type: "RANK" | "KIT"; priceIdr: number; quantity: number }>;
  season: { name: string; endAt: string; freezeDays: number } | null;
  defaults: { mcName: string; email: string };
  signedIn: boolean;
  couponsEnabled: boolean;
  taxPercent: number;
  taxLabel: string;
  minimumAge: number;
  frozen: boolean;
}) {
  const [state, formAction] = useActionState(checkoutAction, initialState);
  const [mcName, setMcName] = useState(defaults.mcName);
  const [email, setEmail] = useState(defaults.email);
  const [coupon, setCoupon] = useState("");
  const [provider, setProvider] = useState(defaultProviderId ?? providers[0]?.id ?? "FAKE");
  const [method, setMethod] = useState<string>(providers[0]?.methods[0]?.code ?? "");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, startPreview] = useTransition();

  const activeProvider = providers.find((p) => p.id === provider) ?? providers[0];
  const methods = activeProvider?.methods ?? [];

  useEffect(() => {
    if (activeProvider && !activeProvider.methods.some((m) => m.code === method)) {
      setMethod(activeProvider.methods[0]?.code ?? "");
    }
  }, [activeProvider, method]);

  async function verifyPlayer() {
    if (!mcName.trim()) return;
    setChecking(true);
    setLookupError(null);
    try {
      const res = await fetch("/api/minecraft/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mcName }),
      });
      const json = (await res.json()) as { ok: boolean; player?: LookupResult; message?: string };
      if (!res.ok || !json.ok || !json.player) throw new Error(json.message ?? "Username tidak ditemukan.");
      setLookup(json.player);
      refreshPreview(json.player.name, coupon);
    } catch (error) {
      setLookup(null);
      setLookupError((error as Error).message);
    } finally {
      setChecking(false);
    }
  }

  function refreshPreview(name: string, couponCode: string) {
    startPreview(async () => {
      const result = await previewTotalsAction({ mcName: name, couponCode });
      setPreview(result);
    });
  }

  const subtotal = preview?.subtotalIdr ?? items.reduce((sum, item) => sum + item.priceIdr * item.quantity, 0);
  const total = preview?.totalIdr ?? subtotal;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <form id="checkout-form" action={formAction} className="space-y-6" noValidate>
        {frozen ? <input type="hidden" name="blockedByFreeze" value="1" /> : null}

        <section className="rounded-lg border border-line bg-surface/50 p-5">
          <h2 className="font-display text-[16px] text-ink">1. Akun Minecraft</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Item dikirim ke akun ini. Identitas disimpan sebagai UUID, jadi ganti nama tidak
            menghilangkan kepemilikan.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Username Minecraft"
              htmlFor="mcName"
              required
              error={state.fields?.mcName ?? lookupError ?? undefined}
              hint="Bedrock: tulis dengan titik (mis. .CipiPlayer) dan verifikasi in-game melalui dashboard sebelum checkout."
            >
              <div className="flex gap-2">
                <Input
                  id="mcName"
                  name="mcName"
                  value={mcName}
                  onChange={(event) => {
                    setMcName(event.target.value);
                    setLookup(null);
                    setPreview(null);
                  }}
                  autoComplete="off"
                  required
                  aria-invalid={Boolean(state.fields?.mcName || lookupError) || undefined}
                  placeholder="CipiPlayer"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void verifyPlayer()}
                  loading={checking}
                  className="shrink-0"
                >
                  {!checking ? <Search className="size-4" aria-hidden /> : null}
                  Cek
                </Button>
              </div>
            </Field>

            <Field label="Email" htmlFor="email" required error={state.fields?.email} hint="Bukti pembayaran dikirim ke sini">
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                aria-invalid={Boolean(state.fields?.email) || undefined}
                placeholder="kamu@email.com"
              />
            </Field>
          </div>

          {lookup ? (
            <div className="mt-4 flex items-center gap-3 rounded-md border border-success/25 bg-success/8 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lookup.headUrl}
                alt=""
                width={40}
                height={40}
                className="size-10 rounded-[4px] border border-line bg-bg pixelated"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13.5px] text-ink">
                  <Check className="size-3.5 text-success" aria-hidden />
                  {lookup.name}
                </p>
                <p className="text-2xs text-muted-2">
                  {lookup.edition === "BEDROCK" ? "Bedrock (Floodgate)" : "Java Edition"} ·{" "}
                  <span className="font-mono">{lookup.uuid.slice(0, 13)}…</span>
                </p>
              </div>
            </div>
          ) : null}

          {!signedIn ? (
            <p className="mt-3 text-2xs leading-relaxed text-muted-2">
              Checkout tanpa akun diperbolehkan. Simpan tautan status pesanan — tautan itu satu-satunya
              cara membuka pesanan tanpa login.
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-line bg-surface/50 p-5">
          <h2 className="font-display text-[16px] text-ink">2. Metode pembayaran</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {providers.map((option) => (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors",
                  provider === option.id
                    ? "border-accent/60 bg-accent/8"
                    : "border-line bg-bg/40 hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name="provider"
                  value={option.id}
                  checked={provider === option.id}
                  onChange={() => setProvider(option.id)}
                  className="mt-0.5 size-4 accent-[#be427e]"
                />
                <span>
                  <span className="block text-[13.5px] text-ink">{option.label}</span>
                  <span className="block text-2xs text-muted-2">
                    {option.mode === "sandbox" ? "Mode sandbox" : "Mode produksi"}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {methods.length > 0 ? (
            <div className="mt-4">
              <Field label="Metode" htmlFor="method">
                <select
                  id="method"
                  name="method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="h-11 w-full rounded-md border border-line bg-bg/60 px-3.5 text-[15px] text-ink focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25"
                >
                  {methods.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.group} — {m.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-line bg-surface/50 p-5">
          <h2 className="font-display text-[16px] text-ink">3. Persetujuan</h2>
          <div className="mt-4 space-y-4">
            <CheckboxField
              name="terms"
              label={
                <>
                  Saya menyetujui{" "}
                  <a href="/legal/syarat-layanan" target="_blank" className="text-accent hover:underline">
                    Syarat Layanan
                  </a>{" "}
                  dan{" "}
                  <a href="/legal/kebijakan-privasi" target="_blank" className="text-accent hover:underline">
                    Kebijakan Privasi
                  </a>
                  .
                </>
              }
              error={state.fields?.terms}
           />
            <CheckboxField
              name="noRefund"
              label="Saya paham semua pembelian bersifat final dan tidak dapat direfund, termasuk bila akun melanggar aturan server."
              error={state.fields?.noRefund}
            />
            <CheckboxField
              name="marketingOptIn"
              label="Kirim info season baru dan pengingat akhir season lewat email (opsional)."
            />
            <p className="text-2xs leading-relaxed text-muted-2">
              Dengan melanjutkan, kamu menyatakan berusia minimal {minimumAge} tahun, atau sudah
              mendapat izin orang tua/wali.
            </p>
          </div>
        </section>

        {state.error ? <Alert tone="danger" title="Checkout belum bisa dilanjutkan">{state.error}</Alert> : null}
        {preview && !preview.ok && preview.errors.length > 0 ? (
          <Alert tone="warning" title="Periksa item di keranjang">
            <ul className="list-disc space-y-1 pl-4">
              {preview.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="lg:hidden">
          <Button type="submit" size="lg" className="w-full" disabled={frozen}>
            Bayar {formatRp(total)}
          </Button>
        </div>
      </form>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="surface-card p-5">
          <h2 className="font-display text-[16px] text-ink">Ringkasan pesanan</h2>
          <ul className="mt-4 space-y-2.5">
            {items.map((item) => {
              const line = preview?.lines.find((l) => l.productId === item.productId);
              return (
                <li key={item.productId} className="flex items-start justify-between gap-3 text-[13px]">
                  <div>
                    <p className="text-ink">{item.name}</p>
                    <p className="text-2xs text-muted-2">
                      {item.type === "RANK" ? "Rank" : "Kit"}
                      {line?.note ? ` · ${line.note}` : ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-ink">
                    {formatRp(line?.amountIdr ?? item.priceIdr * item.quantity)}
                  </span>
                </li>
              );
            })}
          </ul>

          {couponsEnabled ? (
            <div className="mt-4 flex gap-2">
              <Input
                name="couponCode"
                form="checkout-form"
                value={coupon}
                onChange={(event) => {
                  setCoupon(event.target.value.toUpperCase());
                  setPreview(null);
                }}
                placeholder="Kode kupon"
                aria-label="Kode kupon"
                className="h-10"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-10 shrink-0"
                disabled={previewing || !mcName}
                onClick={() => refreshPreview(lookup?.name ?? mcName, coupon)}
              >
                {previewing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                Terapkan
              </Button>
            </div>
          ) : null}

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-ink">{formatRp(subtotal)}</dd>
            </div>
            {preview && preview.discountIdr > 0 ? (
              <div className="flex justify-between text-success">
                <dt>
                  Diskon {preview.discountKind === "AUTOMATIC" && preview.discountLabel
                    ? `(otomatis: ${preview.discountLabel})`
                    : preview.couponApplied
                      ? `(${preview.couponApplied})`
                      : ""}
                </dt>
                <dd>−{formatRp(preview.discountIdr)}</dd>
              </div>
            ) : null}
            {taxPercent > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">{taxLabel} {taxPercent}%</dt>
                <dd className="text-ink">{formatRp(preview?.taxIdr ?? 0)}</dd>
              </div>
            ) : null}
            {preview && preview.feeIdr > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">Biaya layanan</dt>
                <dd className="text-ink">{formatRp(preview.feeIdr)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-2.5 text-[15px]">
              <dt className="text-ink">Total</dt>
              <dd className="font-medium text-ink">{formatRp(total)}</dd>
            </div>
          </dl>

          {season ? (
            <p className="mt-3 rounded-md border border-line bg-bg/40 px-3 py-2 text-2xs leading-relaxed text-muted-2">
              Aktif sampai akhir {season.name}, berakhir {formatDateWIB(new Date(season.endAt))}.
            </p>
          ) : null}

          <Button type="submit" form="checkout-form" size="lg" className="mt-4 hidden w-full lg:inline-flex" disabled={frozen}>
            <ShieldCheck className="size-4" aria-hidden />
            Bayar {formatRp(total)}
          </Button>
          <p className="mt-3 text-2xs leading-relaxed text-muted-2">
            Tombol ini hanya mengirim form di atas. Total final dihitung ulang di server sebelum
            transaksi dibuat.
          </p>
        </div>
      </aside>
    </div>
  );
}
