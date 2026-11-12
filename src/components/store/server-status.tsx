"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Dot } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/feedback";

interface Status {
  online: boolean | null;
  players: number | null;
  maxPlayers: number | null;
  version: string | null;
  source: string;
  checkedAt: string;
  javaHost: string;
  javaPort: number;
  bedrockHost: string;
  bedrockPort: number;
}

export function ServerStatusPanel({ initial }: { initial: Status }) {
  const [status, setStatus] = useState<Status>(initial);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        setRefreshing(true);
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (!cancelled) setStatus(data);
      } catch {
        // biarkan status terakhir; toko tetap bisa dipakai
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }
    const timer = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const online = status.online;
  const javaAddress = status.javaPort === 25565 ? status.javaHost : `${status.javaHost}:${status.javaPort}`;
  const bedrockAddress = `${status.bedrockHost}:${status.bedrockPort}`;

  return (
    <section
      aria-label="Status server"
      className="surface-card relative overflow-hidden p-5 sm:p-6"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Status server</p>
          <div className="mt-2 flex items-baseline gap-2">
            {online === null ? (
              <span className="text-[15px] text-muted">Tidak tersedia</span>
            ) : online ? (
              <>
                <span className="font-display text-[28px] leading-none text-ink">{status.players ?? "—"}</span>
                <span className="text-[13px] text-muted">
                  / {status.maxPlayers ?? "—"} pemain online
                </span>
              </>
            ) : (
              <span className="text-[15px] text-muted">Server sedang offline</span>
            )}
          </div>
          {online === null ? (
            <p className="mt-1 text-2xs text-muted-2">Data pemain tidak bisa diambil saat ini.</p>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface-2/70 px-2.5 py-1 text-2xs text-muted">
          <Dot tone={online === null ? "neutral" : online ? "success" : "danger"} className={online ? "animate-pulse-dot" : ""} />
          {online === null ? "Tidak diketahui" : online ? "Online" : "Offline"}
        </span>
      </div>

      <dl className="mt-5 space-y-3 border-t border-line/80 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <dt className="text-[13px] text-muted">Java Edition</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="break-all font-mono text-[11px] tracking-wide text-ink">{javaAddress}</code>
            <CopyButton value={javaAddress} label="alamat Java" buttonText="Salin" compact />
          </dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <dt className="text-[13px] text-muted">Bedrock Edition</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="break-all font-mono text-[11px] tracking-wide text-ink">{bedrockAddress}</code>
            <CopyButton value={bedrockAddress} label="alamat Bedrock" buttonText="Salin" compact />
          </dd>
        </div>
      </dl>

      <p className="mt-4 flex items-center gap-2 border-t border-line/80 pt-3 text-2xs text-muted-2">
        <span className={refreshing ? "opacity-60" : "opacity-100"}>
          {status.version ? `Paper ${status.version}` : `Port Java ${status.javaPort}`} · Cross-play Java &amp; Bedrock
        </span>
      </p>
    </section>
  );
}

export function ServerStatusSkeleton() {
  return (
    <div className="surface-card p-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <div className="mt-5 space-y-3 border-t border-line pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
