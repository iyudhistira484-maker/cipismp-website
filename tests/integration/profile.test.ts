import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { ProfileError, updateUserProfile } from "@/server/auth/profile";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix().replace(/-/g, "");
const id = `profile_${suffix}`;
const otherId = `profile_other_${suffix}`;

describe.skipIf(!databaseUrl())("profil pengguna", () => {
  beforeAll(async () => {
    await db.insert(users).values([
      { id, email: `profile_${suffix}@example.test`, username: `profile_${suffix}`, passwordHash: "test" },
      { id: otherId, email: `other_${suffix}@example.test`, username: `other_${suffix}`, passwordHash: "test", role: "ADMIN" },
    ]);
  });
  afterAll(async () => {
    await db.delete(users).where(eq(users.id, id));
    await db.delete(users).where(eq(users.id, otherId));
  });
  it("menyimpan nama dan username akun sendiri", async () => {
    await updateUserProfile(id, { displayName: "  Nama Pemain  ", username: `New_${suffix}` });
    expect(await db.query.users.findFirst({ where: eq(users.id, id) })).toMatchObject({ displayName: "Nama Pemain", username: `New_${suffix}` });
  });
  it("perubahan profil admin dan pelanggan tetap pada akun masing-masing", async () => {
    await updateUserProfile(otherId, { displayName: "Admin Cipi", username: `Admin_${suffix}` });
    expect(await db.query.users.findFirst({ where: eq(users.id, otherId) })).toMatchObject({ role: "ADMIN", displayName: "Admin Cipi", username: `Admin_${suffix}` });
    expect(await db.query.users.findFirst({ where: eq(users.id, id) })).toMatchObject({ role: "CUSTOMER", displayName: "Nama Pemain", username: `New_${suffix}` });
  });
  it("menolak format tidak valid dan username milik orang lain tanpa memperbarui data", async () => {
    await expect(updateUserProfile(id, { displayName: "A", username: "valid_name" })).rejects.toBeInstanceOf(ProfileError);
    await expect(updateUserProfile(id, { displayName: "Nama", username: "bad name" })).rejects.toBeInstanceOf(ProfileError);
    await expect(updateUserProfile(id, { displayName: "Nama", username: `ADMIN_${suffix.toUpperCase()}` })).rejects.toThrow("Username ini sudah dipakai.");
    expect(await db.query.users.findFirst({ where: eq(users.id, id) })).toMatchObject({ displayName: "Nama Pemain", username: `New_${suffix}` });
  });
});
