"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addToCart, removeFromCart } from "@/server/cart";
import { getProductById } from "@/server/catalog";
import { getActiveSeason } from "@/server/catalog";
import { assertSameOrigin } from "@/server/csrf";
import { headers } from "next/headers";
import { enforceRateLimit } from "@/server/rate-limit";

export interface CartActionState {
  error?: string;
  ok?: boolean;
}

export async function addToCartAction(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const requestHeaders = await headers();
  assertSameOrigin(
    new Request("http://internal/action", { method: "POST", headers: requestHeaders }),
  );

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "Produk tidak dikenali." };

  const season = await getActiveSeason();
  if (!season) return { error: "Belum ada season aktif. Pembelian dibuka saat season dimulai." };

  const product = await getProductById(productId);
  if (!product || product.status !== "PUBLISHED" || product.deletedAt) {
    return { error: "Produk tidak tersedia." };
  }

  await enforceRateLimit(`cart:add:${productId}`, 30, 60);
  await addToCart(product.id, 1);
  revalidatePath("/keranjang");
  redirect("/keranjang");
}

export async function removeFromCartAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (itemId) await removeFromCart(itemId);
  revalidatePath("/keranjang");
}
