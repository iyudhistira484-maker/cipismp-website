import { expect, test, type Page } from "@playwright/test";
import { randomBytes, createCipheriv } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../../src/server/auth/password";
import { currentStep, generateTotpSecret, totpCode } from "../../src/server/auth/totp";

// These fixtures must only be enabled on a disposable database used by the web server.
const enabled = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(5).toString("hex");
const password = "TestOnly!Pass4829";
const customer = `c${suffix}`, other = `o${suffix}`, staff = `s${suffix}`;
const ids = [customer, other, staff].map((name) => `e2e-${name}`);
const secret = generateTotpSecret();
let pool: Pool;
let ticketId = "";

function encryptedSecret(value: string) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY test tidak valid");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
}

async function login(page: Page, username: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email atau username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test.describe("sesi nyata dan bantuan", () => {
  test.skip(!enabled, "Set E2E_ALLOW_DB_FIXTURES=1 hanya pada database disposable.");
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const hash = await hashPassword(password);
    for (const [index, name] of [customer, other, staff].entries()) {
      await pool.query("INSERT INTO users (id, email, username, password_hash, role, email_verified_at, totp_secret, totp_enabled_at) VALUES ($1,$2,$3,$4,$5,now(),$6,$7)", [ids[index], `${name}@example.test`, name, hash, name === staff ? "SUPPORT" : "CUSTOMER", name === staff ? encryptedSecret(secret) : null, name === staff ? new Date() : null]);
    }
  });
  test.afterAll(async () => {
    if (!pool) return;
    if (ticketId) await pool.query("DELETE FROM notifications WHERE href = $1 OR href = $2", [`/admin/bantuan/${ticketId}`, `/dashboard/bantuan/${ticketId}`]);
    await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM users WHERE id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM login_attempts WHERE email = ANY($1::text[])", [[customer, other, staff, ...[customer, other, staff].map((n) => `${n}@example.test`)]]);
    await pool.end();
  });

  test("login, isolasi percakapan, 2FA staf, balasan dan penutupan", async ({ browser }) => {
    test.setTimeout(60_000);
    const playerContext = await browser.newContext();
    const strangerContext = await browser.newContext();
    const staffContext = await browser.newContext();
    try {
      const player = await playerContext.newPage();
      await login(player, customer);
      await expect(player).toHaveURL(/\/dashboard$/);
      await player.reload();
      await expect(player.getByRole("heading", { level: 1 })).toBeVisible();
      await player.goto("/dashboard/bantuan");
      await player.getByLabel("Judul").fill(`Bantuan ${suffix}`);
      await player.getByLabel("Ceritakan kendalanya").fill("Mohon bantu memeriksa pesanan saya.");
      await player.getByRole("button", { name: "Kirim permintaan" }).click();
      await expect(player).toHaveURL(/\/dashboard\/bantuan\/spt_/);
      ticketId = new URL(player.url()).pathname.split("/").pop()!;

      const stranger = await strangerContext.newPage();
      await login(stranger, other);
      await expect(stranger).toHaveURL(/\/dashboard$/);
      const response = await stranger.goto(`/dashboard/bantuan/${ticketId}`);
      expect(response?.status()).toBe(404);
      await stranger.goto(`/admin/bantuan/${ticketId}`);
      await expect(stranger).toHaveURL(/\/403/);

      const operator = await staffContext.newPage();
      await login(operator, staff);
      await expect(operator).toHaveURL(/\/masuk\/2fa/);
      await operator.goto(`/admin/bantuan/${ticketId}`);
      await expect(operator).toHaveURL(/\/masuk\/2fa/);
      await operator.getByLabel("Kode 6 digit").fill(totpCode(secret, currentStep()));
      await operator.getByRole("button", { name: "Verifikasi", exact: true }).click();
      await expect(operator).toHaveURL(/\/admin/);
      await operator.goto(`/admin/bantuan/${ticketId}`);
      await operator.getByLabel("Tulis balasan").fill("Tim sedang memeriksa permintaan ini.");
      await operator.getByRole("button", { name: "Kirim balasan" }).click();
      await expect(operator.getByText("Tim sedang memeriksa permintaan ini.")).toBeVisible({ timeout: 20_000 });
      await player.reload();
      await expect(player.getByText("Tim sedang memeriksa permintaan ini.")).toBeVisible();
      await operator.getByRole("button", { name: "Tutup permintaan" }).click();
      await expect(operator.getByText("Permintaan sudah ditutup.")).toBeVisible();
      await player.reload();
      await expect(player.getByText(/Permintaan ini sudah ditutup/)).toBeVisible();
    } finally {
      await Promise.all([playerContext.close(), strangerContext.close(), staffContext.close()]);
    }
  });
});
