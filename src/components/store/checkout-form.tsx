"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, Gift, Loader2, Package, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
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
interface LookupResult { name: string; edition: "JAVA" | "BEDROCK" }
interface CheckoutItem { cartItemId: string; productId: string; name: string; type: "RANK" | "KIT" | null; priceIdr: number | null; quantity: number; targetName: string | null; isGift: boolean }
const initialState: CheckoutState = {};

export function CheckoutForm({ providers, defaultProviderId, items, season, defaults, signedIn, couponsEnabled, taxPercent, taxLabel, minimumAge, blocked, offlineMode }: {
  providers: ProviderOption[]; defaultProviderId: string | null; items: CheckoutItem[];
  season: { name: string; endAt: string; freezeDays: number } | null;
  defaults: { mcName: string; email: string }; signedIn: boolean; couponsEnabled: boolean;
  taxPercent: number; taxLabel: string; minimumAge: number; blocked: boolean; offlineMode: boolean;
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
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const lookupRevision = useRef(0);
  const previewRevision = useRef(0);
  const couponRef = useRef(coupon);
  const activeProvider = providers.find((p) => p.id === provider) ?? providers[0];
  const methods = activeProvider?.methods ?? [];

  useEffect(() => {
    if (activeProvider && !activeProvider.methods.some((m) => m.code === method)) setMethod(activeProvider.methods[0]?.code ?? "");
  }, [activeProvider, method]);

  function invalidatePreview() {
    previewRevision.current += 1;
    setPreview(null);
    setPreviewError(null);
  }
  function refreshPreview(name: string, couponCode: string) {
    const revision = ++previewRevision.current;
    setPreview(null);
    setPreviewError(null);
    startPreview(async () => {
      try {
        const result = await previewTotalsAction({ mcName: name, couponCode });
        if (previewRevision.current === revision) setPreview(result);
      } catch {
        if (previewRevision.current === revision) setPreviewError("Perkiraan belum tersedia. Coba periksa lagi.");
      }
    });
  }
  async function verifyPlayer() {
    if (!mcName.trim()) return;
    const revision = ++lookupRevision.current;
    const name = mcName;
    setChecking(true);
    setLookupError(null);
    setLookup(null);
    invalidatePreview();
    try {
      const res = await fetch("/api/minecraft/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const json = (await res.json()) as { ok: boolean; player?: LookupResult; message?: string };
      if (!res.ok || !json.ok || !json.player) throw new Error(json.message ?? "Username tidak ditemukan.");
      if (lookupRevision.current !== revision) return;
      setLookup(json.player);
      refreshPreview(json.player.name, couponRef.current);
    } catch (error) {
      if (lookupRevision.current === revision) setLookupError(error instanceof Error ? error.message : "Username tidak dapat diperiksa.");
    } finally {
      if (lookupRevision.current === revision) setChecking(false);
    }
  }

  const validPreview = preview?.ok ? preview : null;
  const catalogSubtotal = items.every((item) => item.priceIdr !== null) ? items.reduce((sum, item) => sum + (item.priceIdr ?? 0) * item.quantity, 0) : null;
  const submittingLabel = "Lanjutkan pembayaran";

  return (
    <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.85fr)] lg:gap-7">
      <form id="checkout-form" action={formAction} className="order-2 min-w-0 space-y-5 lg:order-none" noValidate>
        <section aria-labelledby="checkout-player" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f9e9f2] font-display text-sm font-semibold text-accent-strong">01</span><div><p className="dashboard-kicker">PEMAIN & KONTAK</p><h2 id="checkout-player" className="mt-1 font-display text-[20px] text-ink">Untuk siapa petualangannya?</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">Username ini adalah pemain pembeli; item hadiah tetap dikirim ke penerima yang tertera pada ringkasan.</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Username Minecraft" htmlFor="mcName" required error={state.fields?.mcName ?? lookupError ?? undefined}><div className="flex min-w-0 gap-2"><Input id="mcName" name="mcName" value={mcName} onChange={(event) => { lookupRevision.current += 1; setChecking(false); setMcName(event.target.value); setLookup(null); setLookupError(null); invalidatePreview(); }} autoComplete="off" required aria-invalid={Boolean(state.fields?.mcName || lookupError) || undefined} aria-describedby="checkout-mc-hint" placeholder="CipiPlayer" /><Button type="button" variant="secondary" onClick={() => void verifyPlayer()} loading={checking} className="h-11 shrink-0">{!checking ? <Search className="size-4" aria-hidden /> : null} Cek</Button></div></Field><Field label="Email pembelian" htmlFor="email" required error={state.fields?.email}><Input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" aria-invalid={Boolean(state.fields?.email) || undefined} aria-describedby="checkout-email-hint" placeholder="kamu@email.com" /></Field></div>
          <p id="checkout-mc-hint" className="mt-3 text-[11px] leading-relaxed text-muted">{offlineMode ? "Java dan Bedrock perlu verifikasi in-game melalui dashboard sebelum checkout. " : "Bedrock perlu verifikasi in-game sebelum checkout. "}Untuk Bedrock, tulis titik di depan username, misalnya <span className="font-mono text-ink">.CipiPlayer</span>. Perubahan nama di server offline dapat mengubah UUID; akses tidak otomatis berpindah.</p><p id="checkout-email-hint" className="mt-2 text-[11px] text-muted">Informasi pesanan dikirim ke email pembelian.</p>
          {lookup ? <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl border border-success/25 bg-[#f6fbf7] p-4"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /><div><p className="break-words text-[13px] font-semibold text-ink">{lookup.name} · {lookup.edition === "BEDROCK" ? "Bedrock" : "Java"}</p><p className="mt-1 text-[11px] leading-relaxed text-muted">Nama ditemukan. Kelayakan pembelian dan penerima tetap diperiksa saat checkout.</p></div></div> : null}
          {!signedIn ? <p className="mt-3 text-[11px] leading-relaxed text-muted">Checkout tamu tersedia; simpan tautan status atau cari pesanan dengan nomor order dan email pembelian.</p> : null}
        </section>
        <section aria-labelledby="checkout-payment" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f4ecf7] font-display text-sm font-semibold text-[#806096]">02</span><div><p className="dashboard-kicker">METODE PEMBAYARAN</p><h2 id="checkout-payment" className="mt-1 font-display text-[20px] text-ink">Pilih cara membayar</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">Opsi yang muncul mengikuti gateway yang tersedia.</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{providers.map((option) => <label key={option.id} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors", provider === option.id ? "border-accent/50 bg-[#fdf3f8]" : "border-line bg-[#fdfafd] hover:border-line-strong")}><input type="radio" name="provider" value={option.id} checked={provider === option.id} onChange={() => setProvider(option.id)} className="mt-0.5 size-4 accent-[#be427e]" /><span><span className="block text-[13px] font-semibold text-ink">{option.label}</span><span className="mt-1 block text-[11px] text-muted">{option.mode === "sandbox" ? "Mode sandbox" : "Mode produksi"}</span></span></label>)}</div>{methods.length > 0 ? <div className="mt-4"><Field label="Metode" htmlFor="method"><select id="method" name="method" value={method} onChange={(event) => setMethod(event.target.value)} className="h-11 w-full rounded-md border border-line bg-bg/60 px-3.5 text-[15px] text-ink focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25">{methods.map((m) => <option key={m.code} value={m.code}>{m.group} — {m.label}</option>)}</select></Field></div> : null}</section>
        <section id="checkout-confirm" aria-labelledby="checkout-agreement" className="scroll-mt-24 rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf5ee] font-display text-sm font-semibold text-success">03</span><div><p className="dashboard-kicker">SEBELUM MELANJUTKAN</p><h2 id="checkout-agreement" className="mt-1 font-display text-[20px] text-ink">Periksa dan setujui</h2></div></div><div className="mt-5 space-y-4"><CheckboxField name="terms" label={<>Saya menyetujui <a href="/legal/syarat-layanan" target="_blank" rel="noreferrer" className="text-accent hover:underline">Syarat Layanan</a> dan <a href="/legal/kebijakan-privasi" target="_blank" rel="noreferrer" className="text-accent hover:underline">Kebijakan Privasi</a>.</>} error={state.fields?.terms} /><CheckboxField name="noRefund" label="Saya paham semua pembelian bersifat final dan tidak dapat direfund, termasuk bila akun melanggar aturan server." error={state.fields?.noRefund} /><CheckboxField name="marketingOptIn" label="Kirim info season baru dan pengingat akhir season lewat email (opsional)." /><p className="text-[11px] leading-relaxed text-muted">Dengan melanjutkan, kamu menyatakan berusia minimal {minimumAge} tahun, atau sudah mendapat izin orang tua/wali.</p></div></section>
        {state.error ? <Alert tone="danger" title="Checkout belum bisa dilanjutkan">{state.error}</Alert> : null}
        {preview && !preview.ok && preview.errors.length ? <Alert tone="warning" title="Periksa item di keranjang"><ul className="list-disc space-y-1 pl-4">{preview.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></Alert> : null}
        {previewError ? <Alert tone="warning">{previewError}</Alert> : null}
        <div><SubmitButton size="lg" className="w-full rounded-xl" disabled={blocked || checking || previewing}><ShieldCheck className="size-4" aria-hidden />{submittingLabel}</SubmitButton><p className="mt-2 text-center text-[11px] leading-relaxed text-muted">Total final dan kelayakan diperiksa kembali oleh server sebelum transaksi dibuat.</p></div>
      </form>
      <aside aria-labelledby="checkout-summary" className="order-1 min-w-0 lg:order-none lg:sticky lg:top-24 lg:self-start"><div className="overflow-hidden rounded-[22px] border border-[#eadde6] bg-white shadow-card"><div className="bg-[#f9f0f5] px-5 py-4 sm:px-6"><p className="dashboard-kicker">ORDER SUMMARY</p><h2 id="checkout-summary" className="mt-1 font-display text-[19px] text-ink">Ringkasan pesanan</h2></div><div className="p-5 sm:p-6"><ul className="space-y-2.5">{items.map((item) => {
        const line = validPreview?.lines.find((entry) => entry.cartItemId === item.cartItemId);
        return <li key={item.cartItemId} className="flex items-start gap-3 rounded-2xl border border-[#f0e5ec] bg-[#fdfafd] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f8eaf2] text-accent"><Package className="size-4" aria-hidden /></span><div className="min-w-0 flex-1"><p className="break-words text-[12px] font-semibold text-ink">{item.name}</p><p className="mt-1 text-[10px] text-muted">{item.type === "RANK" ? "Rank" : item.type === "KIT" ? "Kit" : "Tidak tersedia"}{item.quantity !== 1 ? ` · ${item.quantity}×` : ""}</p><p className="mt-1 flex items-center gap-1 break-words text-[10.5px] leading-relaxed text-accent-strong">{item.isGift ? <><Gift className="size-3 shrink-0" aria-hidden />Hadiah untuk {item.targetName ?? "penerima tidak tersedia"}</> : mcName.trim() ? `Untuk ${lookup?.name ?? mcName}` : "Pemain dipilih di bawah"}</p>{line?.note && !(item.isGift && line.note.startsWith("Hadiah untuk ")) ? <p className="mt-1 text-[10px] text-muted">{line.note}</p> : null}</div><span className="shrink-0 text-[12px] font-semibold text-ink">{line ? formatRp(line.amountIdr) : validPreview ? "—" : item.priceIdr !== null ? formatRp(item.priceIdr * item.quantity) : "—"}</span></li>;
      })}</ul><a href="/keranjang" className="mt-3 inline-block text-[11px] font-semibold text-accent-strong hover:underline">Ubah keranjang →</a>
      {couponsEnabled ? <div className="mt-5"><label htmlFor="couponCode" className="mb-1.5 block text-[12px] font-semibold text-muted">Kode kupon <span className="font-normal text-muted-2">(opsional)</span></label><div className="flex gap-2"><Input id="couponCode" name="couponCode" form="checkout-form" value={coupon} onChange={(event) => { const value = event.target.value.toUpperCase(); couponRef.current = value; setCoupon(value); invalidatePreview(); }} placeholder="Kode kupon" className="h-10 min-w-0" /><Button type="button" variant="secondary" size="sm" className="h-10 shrink-0" disabled={previewing || checking || !mcName.trim()} onClick={() => refreshPreview(lookup?.name ?? mcName, coupon)}>{previewing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Terapkan</Button></div></div> : null}
      <div aria-live="polite"><dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-[12px]"><div className="flex justify-between gap-3"><dt className="text-muted">{validPreview ? "Subtotal perkiraan" : "Subtotal harga katalog"}</dt><dd className="text-ink">{validPreview ? formatRp(validPreview.subtotalIdr) : catalogSubtotal !== null ? formatRp(catalogSubtotal) : "Belum tersedia"}</dd></div>{validPreview && validPreview.discountIdr > 0 ? <div className="flex justify-between gap-3 text-success"><dt>Diskon {validPreview.discountKind === "AUTOMATIC" && validPreview.discountLabel ? `(otomatis: ${validPreview.discountLabel})` : validPreview.couponApplied ? `(${validPreview.couponApplied})` : ""}</dt><dd>−{formatRp(validPreview.discountIdr)}</dd></div> : null}{taxPercent > 0 ? <div className="flex justify-between gap-3"><dt className="text-muted">{taxLabel} {taxPercent}%</dt><dd>{validPreview ? formatRp(validPreview.taxIdr) : "Dihitung setelah cek"}</dd></div> : null}{validPreview && validPreview.feeIdr > 0 ? <div className="flex justify-between gap-3"><dt className="text-muted">Biaya layanan</dt><dd>{formatRp(validPreview.feeIdr)}</dd></div> : null}<div className="flex justify-between gap-3 border-t border-line pt-3 text-[15px] font-semibold text-ink"><dt>Perkiraan total</dt><dd>{validPreview ? formatRp(validPreview.totalIdr) : "Belum dihitung"}</dd></div></dl><p className="mt-2 text-[11px] leading-relaxed text-muted">{previewing ? "Menghitung perkiraan…" : validPreview ? "Harga final dihitung ulang saat checkout." : "Cek username untuk menghitung perkiraan. Harga katalog belum termasuk upgrade, diskon, pajak, atau biaya."}</p></div>
      {season ? <p className="mt-4 flex items-start gap-2 rounded-2xl border border-[#eee0e9] bg-[#fdf8fb] p-3 text-[11px] leading-relaxed text-muted"><CalendarDays className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />Aktif sampai akhir {season.name}, berakhir {formatDateWIB(new Date(season.endAt))}.</p> : null}<a href="#checkout-confirm" className="mt-4 hidden min-h-10 w-full items-center justify-center rounded-xl border border-line-strong text-[12px] font-semibold text-ink hover:border-accent/40 lg:inline-flex">Periksa persetujuan ↓</a></div></div></aside>
    </div>
  );
}
