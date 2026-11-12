"use client";

import { useState } from "react";
import { ChevronDown, CircleHelp, Gamepad2, MonitorPlay } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import type { ServerConnectionInfo } from "@/server/server-status";

type Edition = "java" | "bedrock";

type GuideStep = { title: string; description: string };

const GUIDE_STEPS: Record<Edition, GuideStep[]> = {
  java: [
    {
      title: "Buka Multiplayer",
      description: "Dari menu utama Minecraft: Java Edition, pilih Multiplayer.",
    },
    {
      title: "Tambahkan server",
      description: "Klik Add Server untuk menyiapkan koneksi baru.",
    },
    {
      title: "Masukkan alamat",
      description: "Tempel alamat CipiSMP, simpan, lalu pilih server untuk masuk.",
    },
  ],
  bedrock: [
    {
      title: "Buka menu Servers",
      description: "Dari Play, buka tab Servers di Minecraft: Bedrock Edition.",
    },
    {
      title: "Pilih Add Server",
      description: "Tambahkan server baru dari daftar server yang tersedia.",
    },
    {
      title: "Isi alamat dan port",
      description: "Masukkan alamat serta port di kolomnya, simpan, lalu pilih server.",
    },
  ],
};

export function JoinGuide({
  connection,
  supportEmail,
}: {
  connection: ServerConnectionInfo;
  supportEmail?: string;
}) {
  const [edition, setEdition] = useState<Edition>("java");
  const javaAddress = connection.javaPort === 25565
    ? connection.javaHost
    : `${connection.javaHost}:${connection.javaPort}`;
  const steps = GUIDE_STEPS[edition];
  const isBedrock = edition === "bedrock";

  return (
    <section aria-labelledby="join-guide-heading" className="container-page py-14 sm:py-16">
      <div className="join-guide-shell relative isolate overflow-hidden rounded-[22px] border border-line bg-surface-2 p-5 shadow-card sm:rounded-[26px] sm:p-7 lg:p-9">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent via-accent/30 to-transparent" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-20 -top-28 size-64 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/3 bg-gradient-to-r from-transparent via-accent/20 to-transparent" aria-hidden="true" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="h-px w-7 bg-accent" aria-hidden="true" />
              <p className="eyebrow">Siap bermain</p>
            </div>
            <h2 id="join-guide-heading" className="mt-2 text-balance font-display text-h2 text-ink">
              Masuk ke server dalam 3 langkah.
            </h2>
            <p className="mt-2 max-w-xl text-pretty text-[14px] leading-relaxed text-muted">
              Pilih edisi Minecraft-mu, ikuti langkahnya, lalu salin detail koneksi.
            </p>
          </div>

          <div className="w-full sm:max-w-[340px]">
            <p className="mb-2 pl-1 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-muted-2">
              Pilih edisi
            </p>
            <div role="group" aria-label="Pilih edisi Minecraft" className="relative grid grid-cols-2 rounded-[12px] border border-line-strong/70 bg-white/80 p-1 shadow-sm">
              <span
                className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-[8px] bg-[#19252d] shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: isBedrock ? "translateX(100%)" : "translateX(0)" }}
                aria-hidden="true"
              />
              <button
                type="button"
                aria-pressed={!isBedrock}
                aria-controls="join-guide-panel"
                onClick={() => setEdition("java")}
                className={`relative z-10 inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-2 text-[12px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${!isBedrock ? "text-white" : "text-muted hover:text-ink"}`}
              >
                <MonitorPlay className="size-4" aria-hidden="true" />
                Java Edition
              </button>
              <button
                type="button"
                aria-pressed={isBedrock}
                aria-controls="join-guide-panel"
                onClick={() => setEdition("bedrock")}
                className={`relative z-10 inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-2 text-[12px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isBedrock ? "text-white" : "text-muted hover:text-ink"}`}
              >
                <Gamepad2 className="size-4" aria-hidden="true" />
                Bedrock
              </button>
            </div>
          </div>
        </div>

        <div
          key={edition}
          id="join-guide-panel"
          role="region"
          aria-label={`Panduan ${isBedrock ? "Bedrock" : "Java Edition"}`}
          className="relative mt-6 grid gap-4 animate-[fade-in_440ms_cubic-bezier(0.22,1,0.36,1)_both] lg:mt-7 lg:grid-cols-[minmax(0,1fr)_minmax(290px,0.82fr)]"
        >
          <div className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-2">Langkah masuk</p>
                <h3 className="mt-1 font-display text-[17px] font-semibold text-ink">
                  {isBedrock ? "Bedrock Edition" : "Java Edition"}
                </h3>
              </div>
              <span className="rounded-full border border-accent/15 bg-surface-2 px-2.5 py-1 font-mono text-[9px] tracking-[0.12em] text-accent-strong">
                03 LANGKAH
              </span>
            </div>

            <div className="relative">
              <span className="join-guide__track" aria-hidden="true">
                <span className="join-guide__track-fill" />
              </span>
              <ol className="relative space-y-2.5">
                {steps.map((step, index) => (
                  <li
                    key={`${edition}-${step.title}`}
                    className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-xl border border-transparent p-2 transition-colors duration-200 hover:border-line hover:bg-surface-2/65 animate-[fade-in_420ms_cubic-bezier(0.22,1,0.36,1)_both]"
                    style={{ animationDelay: `${index * 85}ms` }}
                  >
                    <span className="relative z-10 grid size-8 place-items-center rounded-full border border-accent/20 bg-white font-mono text-[10px] font-medium text-accent-strong shadow-[0_1px_3px_rgba(52,39,50,0.07)]">
                      0{index + 1}
                    </span>
                    <span className="min-w-0 py-0.5">
                      <span className="block text-[13px] font-semibold text-ink">{step.title}</span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-muted">{step.description}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <aside className="relative isolate overflow-hidden rounded-2xl bg-[#17232b] p-5 text-white shadow-[0_18px_38px_-24px_rgba(17,27,34,0.7)] sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-accent/15 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-px w-2/3 bg-gradient-to-l from-white/20 to-transparent" aria-hidden="true" />

            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-[#e5a5c2]">
                  {isBedrock ? <Gamepad2 className="size-5" aria-hidden="true" /> : <MonitorPlay className="size-5" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Detail koneksi</p>
                  <h3 className="mt-0.5 font-display text-[17px] font-semibold text-white">CipiSMP</h3>
                </div>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">
                  {isBedrock ? "Bedrock" : "Java"}
                </span>
              </div>

              <div className="mt-5 space-y-2">
                {isBedrock ? (
                  <>
                    <ConnectionField label="Alamat server" value={connection.bedrockHost} />
                    <ConnectionField label="Port" value={String(connection.bedrockPort)} />
                  </>
                ) : (
                  <ConnectionField label="Alamat server" value={javaAddress} />
                )}
              </div>

              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-white/55">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#e5a5c2]" aria-hidden="true" />
                Salin detail di atas ke kolom Add Server di Minecraft.
              </p>
            </div>
          </aside>
        </div>

        <details className="join-guide__troubleshoot group relative mt-4 rounded-xl border border-line bg-white/75">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-3.5 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-accent/15 bg-surface-2 text-accent-strong">
                <CircleHelp className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink">Tidak bisa masuk?</span>
                <span className="mt-0.5 block text-[11px] text-muted">Cek edisi, alamat, dan port server.</span>
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>

          <div className="join-guide__troubleshoot-content border-t border-line px-4 pb-4 pt-4 sm:px-5">
            <ol className="grid gap-3 sm:grid-cols-3">
              <li className="rounded-lg bg-surface-2/70 p-3">
                <span className="font-mono text-[9px] text-accent-strong">01</span>
                <p className="mt-1 text-[11px] font-semibold text-ink">Pilih edisi yang sesuai</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">Java memakai Multiplayer; Bedrock memakai menu Servers.</p>
              </li>
              <li className="rounded-lg bg-surface-2/70 p-3">
                <span className="font-mono text-[9px] text-accent-strong">02</span>
                <p className="mt-1 text-[11px] font-semibold text-ink">Periksa alamat dan port</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">Di Bedrock, alamat dan port diisi pada kolom terpisah.</p>
              </li>
              <li className="rounded-lg bg-surface-2/70 p-3">
                <span className="font-mono text-[9px] text-accent-strong">03</span>
                <p className="mt-1 text-[11px] font-semibold text-ink">Lihat status server</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">Status “Tidak diketahui” berarti pemeriksaan gagal, belum tentu server mati.</p>
              </li>
            </ol>

            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-[11px] leading-relaxed text-muted-2">
                Indikator status default memeriksa koneksi Java; port Bedrock tidak diuji terpisah oleh indikator ini.
              </p>
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-accent transition-colors hover:text-accent-strong hover:underline"
                >
                  Hubungi bantuan
                  <span className="sr-only"> melalui {supportEmail}</span>
                </a>
              ) : null}
            </div>
          </div>
        </details>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Panduan {isBedrock ? "Bedrock" : "Java Edition"} dipilih. {steps.map((step) => step.title).join(", ")}.
        </p>
      </div>
    </section>
  );
}

function ConnectionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.055] px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[10px] text-white/50">{label}</p>
        <p className="mt-1 break-all font-mono text-[12px] font-medium tracking-wide text-white sm:text-[13px]">
          {value}
        </p>
      </div>
      <CopyButton
        value={value}
        label={label.toLowerCase()}
        buttonText="Salin"
        compact
        className="shrink-0 border-white/20 bg-white/[0.07] text-white/75 hover:border-white/35 hover:bg-white/[0.12] hover:text-white focus-visible:ring-[#e5a5c2]/50"
      />
    </div>
  );
}

export function JoinGuideSkeleton() {
  return (
    <section aria-label="Panduan masuk ke server" aria-busy="true" className="container-page py-14 sm:py-16">
      <div className="rounded-[22px] border border-line bg-surface-2 p-5 shadow-card sm:p-7 lg:p-9">
        <div className="h-3 w-24 animate-pulse rounded bg-line-strong/45" />
        <div className="mt-3 h-8 w-3/4 max-w-md animate-pulse rounded bg-line-strong/40" />
        <div className="mt-2 h-4 w-full max-w-lg animate-pulse rounded bg-line-strong/30" />
        <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(290px,0.82fr)]">
          <div className="h-64 animate-pulse rounded-2xl border border-line bg-white/75" />
          <div className="h-64 animate-pulse rounded-2xl bg-[#17232b]/85" />
        </div>
      </div>
    </section>
  );
}
