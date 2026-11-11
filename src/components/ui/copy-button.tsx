"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label,
  buttonText,
  className,
  compact,
}: {
  value: string;
  label?: string;
  buttonText?: string;
  className?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // fallback untuk browser tanpa Clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[6px] border border-line-strong bg-surface-2/80 px-2 py-1 text-2xs text-muted transition-colors duration-150 hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        className,
      )}
      aria-label={copied ? "Tersalin" : `Salin ${label ?? value}`}
    >
      {copied ? <Check className="size-3 text-success" aria-hidden /> : <Copy className="size-3" aria-hidden />}
      <span>{copied ? "Tersalin" : (buttonText ?? label ?? "Salin")}</span>
      {!compact ? <span className="sr-only"> {value}</span> : null}
    </button>
  );
}
