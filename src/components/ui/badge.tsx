import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-muted",
        accent: "border-accent/30 bg-accent/10 text-accent",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        danger: "border-danger/30 bg-danger/10 text-danger",
        info: "border-info/30 bg-info/10 text-info",
        iron: "border-iron/30 bg-iron/10 text-iron",
        gold: "border-gold/35 bg-gold/10 text-gold",
        diamond: "border-diamond/30 bg-diamond/10 text-diamond",
      },
      size: { sm: "px-2 py-0 text-[10px]", md: "" },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export function Badge({
  className,
  tone,
  size,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

export function Dot({ tone = "success", className }: { tone?: "success" | "danger" | "warning" | "neutral"; className?: string }) {
  const color = {
    success: "bg-success",
    danger: "bg-danger",
    warning: "bg-warning",
    neutral: "bg-muted-2",
  }[tone];
  return <span className={cn("inline-block size-1.5 rounded-full", color, className)} aria-hidden />;
}
