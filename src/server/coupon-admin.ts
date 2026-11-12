import { eq } from "drizzle-orm";
import { db } from "./db";
import { coupons, orders } from "./db/schema";

/** Preserve the code attached to historical/pending orders, including late payments. */
export async function updateCouponPreservingOrderReferences(id: string, values: Omit<typeof coupons.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(coupons).where(eq(coupons.id, id)).limit(1).for("update");
    if (!existing) throw new Error("Kupon tidak ditemukan.");
    if (existing.code !== values.code) {
      const [used] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.couponCode, existing.code)).limit(1);
      if (used) throw new Error("Kode kupon yang sudah digunakan pada pesanan tidak dapat diubah. Nonaktifkan kupon dan buat kode baru.");
    }
    await tx.update(coupons).set({ ...values, updatedAt: new Date() }).where(eq(coupons.id, id));
  });
}
