import { expect, test, type Page } from "@playwright/test";
import { createCipheriv, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../../src/server/auth/password";
import { currentStep, generateTotpSecret, totpCode } from "../../src/server/auth/totp";

const enabled = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(5).toString("hex");
const customer = `navc${suffix}`, admin = `nava${suffix}`;
const ids = [`nav-customer-${suffix}`, `nav-admin-${suffix}`];
const password = "TestOnly!Pass4829";
const secret = generateTotpSecret();
let pool: Pool;

function encryptedSecret(value: string) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY test tidak valid");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
}

async function signIn(page: Page, username: string) {
  await page.getByLabel("Email atau username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

async function visitMenu(page: Page, navLabel: string, items: [string, string][]) {
  for (const [label, path] of items) {
    await page.getByRole("navigation", { name: navLabel }).getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`), { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel("Email atau username")).toHaveCount(0);
  }
}

test.describe("sesi saat navigasi", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!enabled, "Hanya untuk database E2E disposable.");
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const hash = await hashPassword(password);
    await pool.query("INSERT INTO users (id,email,username,password_hash,role,email_verified_at,totp_secret,totp_enabled_at) VALUES ($1,$2,$3,$4,'CUSTOMER',now(),null,null),($5,$6,$7,$4,'OWNER',now(),$8,now())", [ids[0], `${customer}@example.test`, customer, hash, ids[1], `${admin}@example.test`, admin, encryptedSecret(secret)]);
  });
  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM users WHERE id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM login_attempts WHERE email = ANY($1::text[])", [[customer, admin, `${customer}@example.test`, `${admin}@example.test`]]);
    await pool.end();
  });

  test("pelanggan tetap masuk saat memilih beberapa menu setelah login", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard/pesanan?q=ujitest");
    await expect(page).toHaveURL(/\/masuk\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/dashboard/pesanan?q=ujitest");
    await signIn(page, customer);
    await expect(page).toHaveURL(/\/dashboard\/pesanan\?q=ujitest$/);
    await visitMenu(page, "Navigasi dashboard", [["Pesanan", "/dashboard/pesanan"], ["Rank & kit", "/dashboard/item"], ["Bantuan", "/dashboard/bantuan"], ["Profil", "/dashboard/profil"], ["Ringkasan", "/dashboard"]]);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    // Session revocation must still take effect; do not solve navigation by bypassing auth.
    await pool.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1", [ids[0]]);
    await page.goto("/dashboard/profil");
    await expect(page).toHaveURL(/\/masuk(?:\?|$)/);
  });

  test("admin tetap masuk setelah 2FA dan memilih beberapa menu", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/masuk\?next=/);
    await signIn(page, admin);
    await expect(page).toHaveURL(/\/masuk\/2fa/);
    await page.getByLabel("Kode 6 digit").fill(totpCode(secret, currentStep()));
    await page.getByRole("button", { name: "Verifikasi", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await visitMenu(page, "Navigasi admin", [["Pesanan", "/admin/pesanan"], ["Produk", "/admin/produk"], ["Bantuan", "/admin/bantuan"], ["Keamanan akun", "/admin/keamanan"], ["Ringkasan", "/admin"]]);
    await page.reload();
    await expect(page).toHaveURL(/\/admin$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Buka navigasi admin" }).click();
    await page.getByRole("navigation", { name: "Navigasi admin" }).getByRole("link", { name: "Pesanan", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pesanan$/);
    await pool.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1", [ids[1]]);
    await page.goto("/admin/produk");
    await expect(page).toHaveURL(/\/masuk\?next=/);
  });
});
