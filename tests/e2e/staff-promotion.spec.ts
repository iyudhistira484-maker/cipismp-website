import { expect, test } from "@playwright/test";
import { randomBytes, createCipheriv } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../../src/server/auth/password";
import { currentStep, generateTotpSecret, totpCode } from "../../src/server/auth/totp";

const enabled = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(5).toString("hex");
const username = `epowner${suffix}`, customerName = `epcustomer${suffix}`;
const ownerId = `e2e-promotion-owner-${suffix}`, customerId = `e2e-promotion-customer-${suffix}`;
const secret = generateTotpSecret(), password = "TestOnly!Pass4829";
let pool: Pool;
function encrypt(value: string) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY test tidak valid");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
}
test.describe("promosi staf", () => {
  test.skip(!enabled, "Hanya untuk database disposable.");
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const hash = await hashPassword(password);
    for (const [id, name, role] of [[ownerId, username, "OWNER"], [customerId, customerName, "CUSTOMER"]]) {
      await pool.query("INSERT INTO users (id,email,username,password_hash,role,email_verified_at,totp_secret,totp_enabled_at) VALUES ($1,$2,$3,$4,$5,now(),$6,now())", [id, `${name}@example.test`, name, hash, role, encrypt(secret)]);
    }
  });
  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM audit_logs WHERE actor_id=$1", [ownerId]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::text[])", [[ownerId, customerId]]);
    await pool.query("DELETE FROM login_attempts WHERE email=ANY($1::text[])", [[username, `${username}@example.test`]]);
    await pool.end();
  });
  test("owner memberi role ke akun terverifikasi yang sama", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/masuk");
    await page.getByLabel("Email atau username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL(/\/masuk\/2fa/);
    await page.getByLabel("Kode 6 digit").fill(totpCode(secret, currentStep()));
    await page.getByRole("button", { name: "Verifikasi", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto(`/admin/pelanggan/${customerId}`);
    await page.getByLabel("Role website").selectOption("ADMIN");
    await page.getByLabel("Alasan dan verifikasi identitas").fill("Identitas staf sudah diverifikasi");
    await page.getByLabel(`Saya sudah memverifikasi ${customerName} dan memahami hak akses yang diberikan.`).check();
    await page.getByRole("button", { name: "Berikan akses staf" }).click();
    await expect(page).toHaveURL(/\/admin\/staf$/, { timeout: 20_000 });
    await expect(page.getByRole("row").filter({ hasText: customerName })).toContainText("Admin");
    expect((await pool.query("SELECT role FROM users WHERE id=$1", [customerId])).rows[0]?.role).toBe("ADMIN");
  });
});
