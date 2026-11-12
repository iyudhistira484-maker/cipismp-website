"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; "error-callback": () => void; "expired-callback": () => void }) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

export function Turnstile({ siteKey, nonce, resetKey }: { siteKey: string; nonce?: string; resetKey?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => () => {
    if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
    widget.current = null;
  }, []);

  useEffect(() => {
    if (resetKey && widget.current) window.turnstile?.reset(widget.current);
  }, [resetKey]);

  function renderWidget() {
    if (!container.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      "error-callback": () => setError(true),
      "expired-callback": () => setError(true),
    });
  }

  return (
    <div>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" nonce={nonce} strategy="afterInteractive" onReady={renderWidget} onError={() => setError(true)} />
      <div ref={container} />
      {error ? <p role="alert" className="text-[12px] text-danger">Verifikasi bot tidak tersedia atau kedaluwarsa. Muat ulang halaman dan coba lagi.</p> : null}
    </div>
  );
}
