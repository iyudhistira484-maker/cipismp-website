import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { beginTotpSetup, confirmTotpSetup, verifyUserTotp } from "@/server/auth/twofactor";
import { currentStep, totpCode } from "@/server/auth/totp";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix();
const userId = `totp-enrollment-${suffix}`;

describe.skipIf(!databaseUrl())("enrollment 2FA staf", () => {
  beforeAll(async () => {
    await db.insert(users).values({ id: userId, email: `totp-${suffix}@example.test`, username: `totp${suffix.replace(/-/g, "")}`, passwordHash: "test", role: "ADMIN" });
  });
  afterAll(async () => { await db.delete(users).where(eq(users.id, userId)); });

  it("menolak secret lama, mengaktifkan setup sekali, dan mencegah replay bersamaan", async () => {
    const old = await beginTotpSetup(userId);
    const fresh = await beginTotpSetup(userId);
    const step = currentStep();
    await expect(confirmTotpSetup(userId, totpCode(old.secret, step))).rejects.toThrow();
    const results = await Promise.allSettled([
      confirmTotpSetup(userId, totpCode(fresh.secret, step)),
      confirmTotpSetup(userId, totpCode(fresh.secret, step)),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expect(beginTotpSetup(userId)).rejects.toThrow(/sudah aktif/i);
    const nextCode = totpCode(fresh.secret, step + 1);
    const attempts = await Promise.all([verifyUserTotp(userId, nextCode), verifyUserTotp(userId, nextCode)]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
  });
});
