"use client";

import { useActionState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToCartAction, type CartActionState } from "@/app/actions/cart";

const initial: CartActionState = {};

export function AddToCart({
  productId,
  disabled,
  label = "Tambah ke keranjang",
  fullWidth = true,
}: {
  productId: string;
  disabled?: boolean;
  label?: string;
  fullWidth?: boolean;
}) {
  const [state, action] = useActionState(addToCartAction, initial);

  return (
    <form action={action} className={fullWidth ? "w-full" : undefined}>
      <input type="hidden" name="productId" value={productId} />
      <Button type="submit" size="lg" disabled={disabled} className={fullWidth ? "w-full" : undefined}>
        <ShoppingBag className="size-4" aria-hidden />
        {label}
      </Button>
      {state?.error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
