import { eq } from "drizzle-orm";
import type { AutomaticDiscountInput } from "@/lib/pricing";
import { db } from "./db";
import { automaticDiscounts } from "./db/schema";

/** Aturan aktif dibaca ulang untuk setiap pratinjau dan checkout; kelayakan waktunya tetap dihitung di mesin harga. */
export async function loadAutomaticDiscounts(): Promise<AutomaticDiscountInput[]> {
  const rows = await db.select().from(automaticDiscounts).where(eq(automaticDiscounts.active, true));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    value: row.value,
    minSubtotalIdr: row.minSubtotalIdr,
    seasonId: row.seasonId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    active: row.active,
    rankOnly: row.rankOnly,
    kitOnly: row.kitOnly,
    eligibleItemsOnly: row.eligibleItemsOnly,
  }));
}
