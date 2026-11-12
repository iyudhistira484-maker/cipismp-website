import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

export class ProfileError extends Error {}

/** Perubahan identitas situs tidak mengubah username atau UUID Minecraft. */
export async function updateUserProfile(userId: string, input: { displayName: string; username: string }) {
  const displayName = input.displayName.trim();
  const username = input.username.trim();
  if (displayName.length < 2 || displayName.length > 40 || /[\u0000-\u001f\u007f]/.test(displayName)) {
    throw new ProfileError("Nama tampilan harus 2–40 karakter.");
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    throw new ProfileError("Username 3–20 karakter, hanya huruf, angka, dan garis bawah.");
  }
  try {
    const updated = await db.update(users).set({ displayName, username, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id });
    if (!updated.length) throw new ProfileError("Akun tidak ditemukan.");
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if ((error && typeof error === "object" && "code" in error && error.code === "23505") ||
        (cause && typeof cause === "object" && "code" in cause && cause.code === "23505")) {
      throw new ProfileError("Username ini sudah dipakai.");
    }
    throw error;
  }
  return { displayName, username };
}
