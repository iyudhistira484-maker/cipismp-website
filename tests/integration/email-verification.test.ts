import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { authTokens, sessions, users } from "@/server/db/schema";
import { sha256 } from "@/server/crypto";
import { consumeEmailChange, consumeEmailVerification } from "@/server/auth/flows";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix();
const userId = `email-verification-${suffix}`;
const oldEmail = `old-${suffix}@example.test`;
const newEmail = `new-${suffix}@example.test`;
const oldToken = `old-token-${suffix}`;
const newToken = `new-token-${suffix}`;
const changeToken = `change-token-${suffix}`;

describe.skipIf(!databaseUrl())("verifikasi dan perubahan email", () => {
  beforeAll(async () => {
    await db.insert(users).values({ id: userId, email: oldEmail, username: `email${suffix.replace(/-/g, "")}`, passwordHash: "test" });
    await db.insert(sessions).values({ id: `email-session-${suffix}`, userId, tokenHash: sha256(`session-${suffix}`), absoluteExpiresAt: new Date(Date.now() + 60_000), idleExpiresAt: new Date(Date.now() + 60_000) });
    await db.insert(authTokens).values([
      { id: `old-${suffix}`, userId, type: "EMAIL_VERIFY", email: oldEmail, tokenHash: sha256(oldToken), expiresAt: new Date(Date.now() + 60_000) },
      { id: `new-${suffix}`, userId, type: "EMAIL_VERIFY", email: newEmail, tokenHash: sha256(newToken), expiresAt: new Date(Date.now() + 60_000) },
      { id: `change-${suffix}`, userId, type: "EMAIL_CHANGE", email: newEmail, tokenHash: sha256(changeToken), expiresAt: new Date(Date.now() + 60_000) },
    ]);
  });
  afterAll(async () => { await db.delete(users).where(eq(users.id, userId)); });

  it("mengubah email sekali dan mencabut sesi pada transaksi yang sama", async () => {
    const results = await Promise.allSettled([consumeEmailChange(changeToken), consumeEmailChange(changeToken)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.query.sessions.findFirst({ where: eq(sessions.id, `email-session-${suffix}`) }))?.revokedAt).not.toBeNull();
    expect(await db.query.users.findFirst({ where: eq(users.id, userId) })).toMatchObject({ email: newEmail, emailVerifiedAt: null });
  });
  it("tidak memverifikasi email baru memakai tautan untuk email lama", async () => {
    await expect(consumeEmailVerification(oldToken)).rejects.toThrow(/email sudah berubah/i);
    expect((await db.query.users.findFirst({ where: eq(users.id, userId) }))?.emailVerifiedAt).toBeNull();
    await consumeEmailVerification(newToken);
    expect((await db.query.users.findFirst({ where: eq(users.id, userId) }))?.emailVerifiedAt).not.toBeNull();
  });
});
