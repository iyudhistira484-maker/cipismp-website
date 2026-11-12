"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

export function ItemTooltip({
  children,
  title,
  subtitle,
  lines,
  enchantments,
  className,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  lines?: string[];
  enchantments?: string[];
  className?: string;
}) {
  return (
    <TooltipPrimitive.Root delayDuration={120}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={8}
          className={cn(
            "z-50 w-56 rounded-lg border border-line-strong bg-white px-3 py-2.5 shadow-pop",
            "data-[state=delayed-open]:animate-fade-in",
            className,
          )}
        >
          <p className="font-mono text-[10px] leading-relaxed tracking-wide text-ink">{title}</p>
          {subtitle ? <p className="mt-0.5 text-[11px] text-muted-2">{subtitle}</p> : null}
          {enchantments?.length ? (
            <ul className="mt-1 space-y-0.5">
              {enchantments.map((ench) => (
                <li key={ench} className="text-[11px] text-accent-strong">
                  {ench}
                </li>
              ))}
            </ul>
          ) : null}
          {lines?.length ? (
            <ul className="mt-1 space-y-0.5 border-t border-line pt-1.5">
              {lines.map((line) => (
                <li key={line} className="text-[11px] leading-relaxed text-muted">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          <TooltipPrimitive.Arrow className="fill-white" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
