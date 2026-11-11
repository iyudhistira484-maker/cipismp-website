"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, ShoppingBag, X } from "lucide-react";

export function MobileNav({
  items,
  signedIn,
  cartCount,
  isStaff,
}: {
  items: Array<{ href: string; label: string }>;
  signedIn: boolean;
  cartCount: number;
  isStaff: boolean;
}) {
  const [open, setOpen] = useState(false);
  const links = [
    ...items,
    { href: "/keranjang", label: `Keranjang${cartCount > 0 ? ` (${cartCount})` : ""}` },
    signedIn ? { href: "/dashboard", label: "Dashboard" } : { href: "/masuk", label: "Masuk" },
    ...(signedIn ? [] : [{ href: "/daftar", label: "Daftar" }]),
    ...(isStaff ? [{ href: "/admin", label: "Panel admin" }] : []),
  ];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 md:hidden"
          aria-label="Buka menu"
        >
          <Menu className="size-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-in md:hidden" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[86%] max-w-sm flex-col border-l border-line bg-surface p-5 data-[state=open]:animate-slide-in md:hidden">
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-lg">Menu</Dialog.Title>
            <Dialog.Close className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Tutup menu">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <nav className="mt-6 flex flex-col" aria-label="Navigasi seluler">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/70 py-3.5 text-[15px] text-ink transition-colors hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-2 pt-6 text-2xs text-muted-2">
            <ShoppingBag className="size-3.5" aria-hidden />
            Pengiriman otomatis setelah pembayaran terverifikasi.
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
