import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { cartItems, carts } from "./db/schema";
import { ids } from "./ids";
import { getViewer } from "./auth/guard";
import { cookiePolicy } from "@/lib/cookie-policy";

export const GUEST_COOKIE = "cipi_guest";

export interface CartLine {
  id: string;
  productId: string;
  quantity: number;
  /** Penerima hadiah; null berarti dibeli untuk pembeli sendiri. */
  targetUuid: string | null;
  targetName: string | null;
  isGift: boolean;
  addedAt: Date;
}

export interface CartIdentity {
  cartId: string | null;
  userId: string | null;
  guestKey: string | null;
}

/** Membaca identitas keranjang tanpa menulis cookie (aman di RSC). */
export async function getCartIdentity(): Promise<CartIdentity> {
  const viewer = await getViewer();
  const jar = await cookies();
  const guestKey = jar.get(GUEST_COOKIE)?.value ?? null;
  if (viewer) {
    const existing = await db.query.carts.findFirst({ where: eq(carts.userId, viewer.user.id) });
    if (existing) return { cartId: existing.id, userId: viewer.user.id, guestKey };
    return { cartId: null, userId: viewer.user.id, guestKey };
  }
  if (guestKey) {
    const existing = await db.query.carts.findFirst({ where: eq(carts.guestKey, guestKey) });
    if (existing) return { cartId: existing.id, userId: null, guestKey };
  }
  return { cartId: null, userId: null, guestKey };
}

/** Dipakai hanya dari server action / route handler. */
export async function getOrCreateCart(): Promise<CartIdentity & { cartId: string }> {
  const identity = await getCartIdentity();
  if (identity.cartId) return { ...identity, cartId: identity.cartId };

  const jar = await cookies();
  let guestKey = identity.guestKey;
  if (!identity.userId && !guestKey) {
    guestKey = ids.cartItem().replace("cit", "");
    jar.set(GUEST_COOKIE, guestKey, {
      ...cookiePolicy(process.env.NODE_ENV, process.env.PREVIEW_PARTITIONED_COOKIES),
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const id = ids.cart();
  await db.insert(carts).values({ id, userId: identity.userId, guestKey: identity.userId ? null : guestKey });
  return { cartId: id, userId: identity.userId, guestKey };
}

export async function getCartLines(cartId: string | null): Promise<CartLine[]> {
  if (!cartId) return [];
  const rows = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.createdAt);
  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    quantity: row.quantity,
    targetUuid: row.targetUuid,
    targetName: row.targetName,
    isGift: row.isGift,
    addedAt: row.createdAt,
  }));
}

export async function getCartCount(): Promise<number> {
  const identity = await getCartIdentity();
  const lines = await getCartLines(identity.cartId);
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export interface CartTarget {
  /** Username yang sudah diverifikasi ke UUID oleh pemanggil. */
  uuid: string;
  name: string;
}

export async function addToCart(productId: string, quantity = 1, gift?: CartTarget | null): Promise<void> {
  const cart = await getOrCreateCart();
  const targetUuid = gift?.uuid ?? null;
  const existing = await db.query.cartItems.findFirst({
    where: and(
      eq(cartItems.cartId, cart.cartId),
      eq(cartItems.productId, productId),
      targetUuid ? eq(cartItems.targetUuid, targetUuid) : isNull(cartItems.targetUuid),
    ),
  });
  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: 1 })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      id: ids.cartItem(),
      cartId: cart.cartId,
      productId,
      quantity,
      targetUuid,
      targetName: gift?.name ?? null,
      isGift: Boolean(gift),
    });
  }
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.cartId));
}

export async function removeFromCart(itemId: string): Promise<void> {
  const identity = await getCartIdentity();
  if (!identity.cartId) return;
  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, identity.cartId)));
}

export async function clearCart(cartId: string): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

/**
 * Setelah login, keranjang tamu digabung ke keranjang akun. Item yang sama
 * dijumlahkan; tidak ada harga yang dihitung di sini.
 */
export async function mergeGuestCart(userId: string, guestKey: string | null): Promise<void> {
  if (!guestKey) return;
  const guestCart = await db.query.carts.findFirst({ where: eq(carts.guestKey, guestKey) });
  if (!guestCart) return;
  const userCart = await db.query.carts.findFirst({ where: eq(carts.userId, userId) });

  if (!userCart) {
    // Belum ada keranjang akun: keranjang tamu diadopsi apa adanya.
    await db.update(carts).set({ userId, guestKey: null }).where(eq(carts.id, guestCart.id));
    return;
  }

  const guestLines = await db.select().from(cartItems).where(eq(cartItems.cartId, guestCart.id));
  for (const line of guestLines) {
    const existing = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.cartId, userCart.id),
        eq(cartItems.productId, line.productId),
        line.targetUuid ? eq(cartItems.targetUuid, line.targetUuid) : isNull(cartItems.targetUuid),
      ),
    });
    if (existing) {
      await db
        .update(cartItems)
        .set({ quantity: 1 })
        .where(eq(cartItems.id, existing.id));
    } else {
      await db.insert(cartItems).values({
        id: ids.cartItem(),
        cartId: userCart.id,
        productId: line.productId,
        quantity: line.quantity,
        targetUuid: line.targetUuid,
        targetName: line.targetName,
        isGift: line.isGift,
      });
    }
  }
  await db.delete(carts).where(eq(carts.id, guestCart.id));
}
