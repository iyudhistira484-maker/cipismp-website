import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/server/csrf";
import { removeFromCart } from "@/server/cart";

/** Native POST/redirect/GET returns the authoritative cart even if hydration is slow. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const value = form?.get("itemId");
  const itemId = typeof value === "string" ? value : "";
  if (!itemId || itemId.length > 256) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 400 });
  // removeFromCart scopes the deletion to the current user's or guest's cart.
  await removeFromCart(itemId);
  revalidatePath("/keranjang");
  revalidatePath("/checkout");
  return new Response(null, { status: 303, headers: { Location: "/keranjang", "Cache-Control": "no-store" } });
}
