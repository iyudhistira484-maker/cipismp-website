import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Tautan unduh CSV; tidak butuh JavaScript dan tercatat di audit log saat diakses. */
export function ExportLink({
  type,
  from,
  to,
  label,
  className,
}: {
  type: "orders" | "customers";
  from?: string;
  to?: string;
  label: string;
  className?: string;
}) {
  const params = new URLSearchParams({ type });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return (
    <a
      href={`/api/admin/export?${params.toString()}`}
      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), className)}
      download
    >
      <Download className="size-3.5" aria-hidden />
      {label}
    </a>
  );
}
