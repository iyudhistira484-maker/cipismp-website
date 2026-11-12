import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { auditLogs, staffMinecraftAccounts, users } from "./db/schema";
import { ids } from "./ids";
import { isStaff } from "./rbac";
import type { AuditActor } from "./audit";

export function canonicalMinecraftUuid(raw: string): string {
  const uuid = raw.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid) || uuid === "00000000-0000-0000-0000-000000000000") {
    throw new Error("UUID Minecraft harus berbentuk lengkap dan valid.");
  }
  return uuid;
}

export async function listStaffMinecraftAccounts() {
  return db.select({ uuid: staffMinecraftAccounts.uuid, label: staffMinecraftAccounts.label,
    staffUserId: users.id, username: users.username, email: users.email, role: users.role,
    createdAt: staffMinecraftAccounts.createdAt })
    .from(staffMinecraftAccounts).innerJoin(users, eq(users.id, staffMinecraftAccounts.staffUserId))
    .orderBy(asc(users.username), asc(staffMinecraftAccounts.label), asc(staffMinecraftAccounts.uuid));
}

export async function registerStaffMinecraftAccount(input: { uuid: string; staffUserId: string; label: string; reason: string; actor: AuditActor; ip: string }) {
  const uuid = canonicalMinecraftUuid(input.uuid);
  const label = input.label.trim();
  const reason = input.reason.trim();
  if (!label || label.length > 64 || reason.length < 10 || reason.length > 500) throw new Error("Label wajib diisi dan alasan harus 10–500 karakter.");
  await db.transaction(async (tx) => {
    const [staff] = await tx.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.staffUserId)).for("update").limit(1);
    if (!staff || !isStaff(staff.role)) throw new Error("Pilih akun website staf yang masih aktif.");
    const inserted = await tx.insert(staffMinecraftAccounts).values({ uuid, staffUserId: staff.id, label }).onConflictDoNothing().returning({ uuid: staffMinecraftAccounts.uuid });
    if (!inserted.length) throw new Error("UUID sudah terdaftar. Periksa kepemilikan sebelum mengubahnya.");
    await tx.insert(auditLogs).values({ id: ids.audit(), actorId: input.actor.id, actorLabel: input.actor.label,
      action: "staff.minecraft.registered", targetType: "staff_minecraft_account", targetId: uuid,
      after: { staffUserId: staff.id, label }, reason, ip: input.ip });
  });
}

export async function removeStaffMinecraftAccount(input: { uuid: string; reason: string; actor: AuditActor; ip: string }) {
  const uuid = canonicalMinecraftUuid(input.uuid);
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 500) throw new Error("Alasan harus 10–500 karakter.");
  await db.transaction(async (tx) => {
    const [previous] = await tx.delete(staffMinecraftAccounts).where(eq(staffMinecraftAccounts.uuid, uuid)).returning();
    if (!previous) throw new Error("UUID tidak ditemukan atau sudah dihapus.");
    await tx.insert(auditLogs).values({ id: ids.audit(), actorId: input.actor.id, actorLabel: input.actor.label,
      action: "staff.minecraft.removed", targetType: "staff_minecraft_account", targetId: uuid,
      before: { staffUserId: previous.staffUserId, label: previous.label }, reason, ip: input.ip });
  });
}
