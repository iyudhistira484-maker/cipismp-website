"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const WORLD_SHOTS = [
  {
    src: "/images/gameplay/season-one-spawn.webp",
    alt: "Papan CipiSMP Season 1 di area yang dikelilingi bangunan dan jalan batu.",
    label: "Season 1",
    title: "Papan CipiSMP Season 1",
    description: "Papan Season 1 terlihat di antara bangunan dan jalan batu.",
  },
  {
    src: "/images/gameplay/spawn-market.webp",
    alt: "Panorama area spawn CipiSMP dengan deretan bangunan di sepanjang jalan.",
    label: "Area spawn",
    title: "Suasana di area spawn",
    description: "Deretan bangunan mengapit jalan di area spawn.",
  },
  {
    src: "/images/gameplay/forest-path.webp",
    alt: "Jalur batu berundak di antara pepohonan lebat.",
    label: "Jalur hutan",
    title: "Jalur di antara pepohonan",
    description: "Jalur batu berundak membelah pepohonan yang rimbun.",
  },
] as const;

export function GameplayGallery() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeShot = WORLD_SHOTS[activeIndex] ?? WORLD_SHOTS[0];

  function selectSlide(index: number) {
    setActiveIndex((index + WORLD_SHOTS.length) % WORLD_SHOTS.length);
  }

  return (
    <section aria-labelledby="world-gallery-heading" className="container-page py-14 sm:py-16">
      <div className="flex flex-col gap-4 border-t border-line pt-9 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <p className="eyebrow">Di dalam game</p>
          </div>
          <h2 id="world-gallery-heading" className="mt-2 text-balance font-display text-h2 text-ink">
            Seperti apa dunia CipiSMP?
          </h2>
          <p className="mt-2 max-w-xl text-pretty text-[14px] leading-relaxed text-muted">
            Tiga screenshot dari area spawn, papan Season 1, hingga jalur hutan.
          </p>
        </div>
        <Link
          href="/cara-kerja"
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-accent transition-colors hover:text-accent-strong"
        >
          Cara bergabung
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div
        role="region"
        aria-label="Galeri screenshot gameplay CipiSMP"
        aria-roledescription="carousel"
        className="mt-7 overflow-hidden rounded-[20px] border border-[#27343d] bg-[#17222b] shadow-[0_24px_60px_-32px_rgba(35,24,34,0.48)] sm:rounded-[24px]"
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_316px]">
          <div className="relative aspect-[16/10] overflow-hidden bg-[#101820] sm:aspect-[16/9] lg:aspect-auto lg:min-h-[420px]">
            <div
              className="absolute inset-y-0 left-0 flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{
                width: `${WORLD_SHOTS.length * 100}%`,
                transform: `translate3d(-${(activeIndex * 100) / WORLD_SHOTS.length}%, 0, 0)`,
              }}
            >
              {WORLD_SHOTS.map((shot, index) => (
                <div
                  key={shot.src}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Screenshot ${index + 1} dari ${WORLD_SHOTS.length}`}
                  aria-hidden={index !== activeIndex}
                  className="relative h-full shrink-0"
                  style={{ width: `${100 / WORLD_SHOTS.length}%` }}
                >
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    fill
                    priority={index === 0}
                    sizes="(min-width: 1220px) 760px, (min-width: 1024px) 62vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d151c]/35 via-transparent to-[#0d151c]/10"
              aria-hidden="true"
            />
            <div className="pointer-events-none absolute left-4 top-4 sm:left-6 sm:top-6" aria-hidden="true">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-[#111a22]/55 px-3 py-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-white/95 shadow-sm backdrop-blur-md sm:text-[10px]">
                <span className="size-1.5 rounded-full bg-[#e39abc]" />
                CipiSMP · Gameplay
              </span>
            </div>
            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between sm:inset-x-6 sm:bottom-6" aria-hidden="true">
              <span className="h-px w-12 bg-white/75 sm:w-16" />
              <span className="font-mono text-[10px] tracking-[0.16em] text-white/80">
                0{activeIndex + 1} <span className="text-white/45">/</span> 0{WORLD_SHOTS.length}
              </span>
            </div>
          </div>

          <aside className="flex min-w-0 flex-col justify-between gap-6 border-t border-white/10 p-5 text-white sm:p-6 lg:border-l lg:border-t-0 lg:p-7">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Dunia CipiSMP
                </p>
                <p className="font-mono text-[11px] tabular-nums text-white/70" aria-hidden="true">
                  0{activeIndex + 1}<span className="px-1.5 text-white/30">/</span>0{WORLD_SHOTS.length}
                </p>
              </div>

              <div className="mt-5 h-px bg-white/10" aria-hidden="true" />

              <div className="mt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#e5a5c2]">
                  {activeShot.label}
                </p>
                <h3 className="mt-2 font-display text-[22px] font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[25px]">
                  {activeShot.title}
                </h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-white/65">
                  {activeShot.description}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
                  Pilih cuplikan
                </p>
                <div className="h-px flex-1 bg-white/10" aria-hidden="true">
                  <div
                    className="h-full bg-[#d989ad] transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${((activeIndex + 1) / WORLD_SHOTS.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                {WORLD_SHOTS.map((shot, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={shot.src}
                      type="button"
                      aria-label={`Tampilkan screenshot ${index + 1}: ${shot.label}`}
                      aria-pressed={isActive}
                      onClick={() => selectSlide(index)}
                      className={`group flex w-full items-center gap-3 rounded-[10px] border p-1.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5a5c2] ${
                        isActive
                          ? "border-white/20 bg-white/[0.08]"
                          : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="relative h-10 w-[60px] shrink-0 overflow-hidden rounded-[6px] bg-[#283640] sm:h-11 sm:w-[66px]">
                        <Image src={shot.src} alt="" fill sizes="66px" className="object-cover" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[9px] text-white/40">0{index + 1}</span>
                        <span className={`mt-0.5 block truncate text-[11px] font-medium ${isActive ? "text-white" : "text-white/65"}`}>
                          {shot.label}
                        </span>
                      </span>
                      <span
                        className={`mr-1 size-1.5 shrink-0 rounded-full bg-[#e5a5c2] transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3.5">
                <p className="text-[10px] text-white/45">Jelajahi screenshot</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectSlide(activeIndex - 1)}
                    aria-label="Screenshot sebelumnya"
                    className="grid size-9 place-items-center rounded-full border border-white/15 text-white/75 transition-colors hover:border-white/35 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5a5c2]"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSlide(activeIndex + 1)}
                    aria-label="Screenshot berikutnya"
                    className="grid size-9 place-items-center rounded-full border border-white/15 text-white/75 transition-colors hover:border-white/35 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5a5c2]"
                  >
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Screenshot {activeIndex + 1} dari {WORLD_SHOTS.length}: {activeShot.title}
      </p>
    </section>
  );
}
