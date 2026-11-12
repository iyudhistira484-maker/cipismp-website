import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { minecraftProfiles, staffMinecraftAccounts, users } from "./db/schema";
import { STAFF_ROLES } from "./rbac";

/** A dispatch-time check also covers known staff changes after checkout. */
export function knownStaffDeliveryQuery(uuid: string, orderId: string | null) {
  return sql`SELECT EXISTS (
    SELECT 1 FROM minecraft_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.verified_at IS NOT NULL AND lower(p.uuid) = lower(${uuid}) AND u.role IN ('OWNER', 'ADMIN', 'SUPPORT')
    UNION ALL
    SELECT 1 FROM orders o JOIN users u ON u.id = o.user_id
    WHERE o.id = ${orderId} AND u.role IN ('OWNER', 'ADMIN', 'SUPPORT')
    UNION ALL
    SELECT 1 FROM staff_minecraft_accounts a JOIN users u ON u.id = a.staff_user_id
    WHERE u.role IN ('OWNER', 'ADMIN', 'SUPPORT') AND (
      lower(a.uuid) = lower(${uuid}) OR EXISTS (
        SELECT 1 FROM orders o WHERE o.id = ${orderId} AND (
          lower(o.mc_uuid) = lower(a.uuid) OR EXISTS (
            SELECT 1 FROM minecraft_profiles p WHERE p.user_id = o.user_id AND p.verified_at IS NOT NULL AND lower(p.uuid) = lower(a.uuid)
          )
        )
      )
    )
  ) AS restricted`;
}

/** Only verified links are evidence. This cannot identify an unregistered alternate account. */
export async function hasKnownStaffRankRestriction(buyerId: string | null | undefined, recipientUuids: string[]): Promise<boolean> {
  if (buyerId) {
    const buyer = await db.query.users.findFirst({ columns: { role: true }, where: eq(users.id, buyerId) });
    if (buyer && STAFF_ROLES.includes(buyer.role)) return true;
  }
  const uuids = [...new Set(recipientUuids.map((uuid) => uuid.toLowerCase()))];
  if (buyerId) {
    const buyerMatches = await db.select({ uuid: staffMinecraftAccounts.uuid }).from(staffMinecraftAccounts)
      .innerJoin(users, eq(users.id, staffMinecraftAccounts.staffUserId))
      .innerJoin(minecraftProfiles, sql`lower(${minecraftProfiles.uuid}) = lower(${staffMinecraftAccounts.uuid})`)
      .where(and(eq(minecraftProfiles.userId, buyerId), isNotNull(minecraftProfiles.verifiedAt), inArray(users.role, STAFF_ROLES))).limit(1);
    if (buyerMatches.length) return true;
  }
  if (!uuids.length) return false;
  const registered = await db.select({ uuid: staffMinecraftAccounts.uuid }).from(staffMinecraftAccounts)
    .innerJoin(users, eq(users.id, staffMinecraftAccounts.staffUserId))
    .where(and(inArray(users.role, STAFF_ROLES), inArray(sql<string>`lower(${staffMinecraftAccounts.uuid})`, uuids))).limit(1);
  if (registered.length) return true;
  const matches = await db.select({ id: minecraftProfiles.id }).from(minecraftProfiles)
    .innerJoin(users, eq(users.id, minecraftProfiles.userId))
    .where(and(isNotNull(minecraftProfiles.verifiedAt), inArray(users.role, STAFF_ROLES), inArray(sql<string>`lower(${minecraftProfiles.uuid})`, uuids)))
    .limit(1);
  return matches.length > 0;
}
