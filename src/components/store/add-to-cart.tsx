"use client";

import { useActionState, useState } from "react";
import { Gift, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToCartAction, type CartActionState } from "@/app/actions/cart";

const initial: CartActionState = {};

export function AddToCart({
  productId,
  disabled,
  label = "Tambah ke keranjang",
  fullWidth = true,
  giftingEnabled = false,
}: {
  productId: string;
  disabled?: boolean;
  label?: string;
  fullWidth?: boolean;
  giftingEnabled?: boolean;
}) {
  const [state, action] = useActionState(addToCartAction, initial);
  const [isGift, setIsGift] = useState(false);
  const [giftName, setGiftName] = useState("");
  const [giftEdition, setGiftEdition] = useState("");

  return (
    <form action={action} className={fullWidth ? "w-full" : undefined}>
      <input type="hidden" name="productId" value={productId} />

      {giftingEnabled ? (
        <div className="mb-3 rounded-md border border-line bg-surface/50 p-3">
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input
              type="checkbox"
              name="isGift"
              checked={isGift}
              onChange={(event) => setIsGift(event.target.checked)}
              className="accent-accent"
            />
            <Gift className="size-3.5 text-accent" aria-hidden />
            Belikan untuk pemain lain
          </label>
          {isGift ? (
            <div className="mt-2.5">
              <label htmlFor={`gift-${productId}`} className="mb-1 block text-[12.5px] text-muted">
                Username penerima
              </label>
              <input
                id={`gift-${productId}`}
                name="giftName"
                value={giftName}
                onChange={(event) => setGiftName(event.target.value)}
                required
                autoComplete="off"
                placeholder="NamaPemain"
                className="h-10 w-full rounded-md border border-line bg-bg/60 px-3 text-[14px] text-ink placeholder:text-muted-2 focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
              <label htmlFor={`gift-edition-${productId}`} className="mt-2 block text-[12.5px] text-muted">Edisi penerima</label>
              <select id={`gift-edition-${productId}`} name="giftEdition" value={giftEdition} onChange={(event) => setGiftEdition(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink">
                <option value="">Pilih edisi</option><option value="JAVA">Java</option><option value="BEDROCK">Bedrock</option>
              </select>
              <p className="mt-1 text-2xs text-muted-2">Bedrock: masukkan nama server dengan awalan _, misalnya _CipiPlayer. Pilih edisi yang benar.</p>
              <p className="mt-1.5 text-2xs leading-relaxed text-muted-2">
                Aturan rank dicek terhadap penerima: tidak bisa membelikan rank yang sudah dia miliki,
                dan upgrade hanya menagih selisih. Rank tetap berakhir di akhir season.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={disabled} className={fullWidth ? "w-full" : undefined}>
        <ShoppingBag className="size-4" aria-hidden />
        {isGift ? "Tambahkan sebagai hadiah" : label}
      </Button>
      {state?.error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
