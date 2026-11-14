"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addToCart, removeFromCart } from "@/server/cart";
import { getProductById } from "@/server/catalog";
import { getActiveSeason } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { InvalidUsernameError, resolvePlayer } from "@/server/minecraft";
import { env } from "@/server/env";
import { assertSameOrigin, clientIp } from "@/server/csrf";
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

  const giftName = String(formData.get("giftName") ?? "").trim();
  let gift: { uuid: string; name: string } | null = null;
  if (giftName) {
    const settings = await getSettings();
    if (!settings.features.gifting) return { error: "Fitur hadiah sedang dinonaktifkan." };
    try {
      const edition = String(formData.get("giftEdition") ?? "") || undefined;
      if (edition && edition !== "JAVA" && edition !== "BEDROCK") return { error: "Pilih edisi penerima yang valid." };
      const recipient = await resolvePlayer(giftName, edition === "JAVA" || edition === "BEDROCK" ? edition : undefined);
      if ((recipient.edition === "BEDROCK" || env.MINECRAFT_LOOKUP_MODE === "offline") && recipient.source !== "cache") {
        return { error: "Penerima harus menghubungkan akun Minecraft di server sebelum menerima hadiah." };
      }
      gift = { uuid: recipient.uuid, name: recipient.name };
    } catch (error) {
      if (error instanceof InvalidUsernameError) return { error: error.message };
      return { error: "Username penerima hadiah tidak bisa diverifikasi." };
    }
  }

  await enforceRateLimit(`cart:add:${clientIp(requestHeaders)}`, 30, 60);
  await addToCart(product.id, 1, gift);
  revalidatePath("/keranjang");
  redirect("/keranjang");
}

export async function removeFromCartAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (itemId) await removeFromCart(itemId);
  revalidatePath("/keranjang");
}
