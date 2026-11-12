import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(5).toString("hex");
const roles = ["OWNER", "SUPPORT", "CUSTOMER"] as const;
const fixtures = Object.fromEntries(roles.map((role) => [role, { id: `admin-design-${role.toLowerCase()}-${suffix}`, token: randomBytes(32).toString("base64url") }])) as Record<(typeof roles)[number], { id: string; token: string }>;
const noMfaToken = randomBytes(32).toString("base64url");
let pool: Pool;

test.describe("tampilan dan akses panel admin", () => {
  test.skip(!enabled, "Hanya untuk database E2E disposable.");
  test.setTimeout(100_000);
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    for (const role of roles) {
      const fixture = fixtures[role];
      await pool.query("insert into users (id,email,username,display_name,password_hash,role,email_verified_at,totp_enabled_at) values ($1,$2,$3,$4,'unused',$5,now(),case when $6::boolean then now() else null end)", [fixture.id, `${fixture.id}@example.test`, `${role.toLowerCase()}${suffix}`, `Uji ${role}`, role, role !== "CUSTOMER"]);
      await pool.query("insert into sessions (id,token_hash,user_id,mfa_satisfied_at,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now(),now()+interval '1 hour',now()+interval '1 hour')", [`session-${fixture.id}`, createHash("sha256").update(fixture.token).digest("hex"), fixture.id]);
    }
    await pool.query("insert into sessions (id,token_hash,user_id,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [`no-mfa-${suffix}`, createHash("sha256").update(noMfaToken).digest("hex"), fixtures.OWNER.id]);
  });
  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from users where id=any($1::text[])", [roles.map((role) => fixtures[role].id)]);
    await pool.end();
  });

  test("menu mobile terkelompok, navigasi dan filter pesanan berfungsi", async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await context.addCookies([{ name: "cipi_session", value: fixtures.OWNER.token, url: baseURL! }]);
    await page.goto("/admin", { waitUntil: "load" });
    const menu = page.getByRole("button", { name: /Menu Ringkasan/ });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    const navigation = page.getByRole("navigation", { name: "Navigasi admin" });
    await expect(navigation.getByText("Toko & konten")).toBeVisible();
    await navigation.getByRole("link", { name: "Pesanan", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pesanan/);
    await expect(page.getByRole("heading", { name: "Pesanan.", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Menu Pesanan/ })).toHaveAttribute("aria-expanded", "false");
    await page.getByLabel("Cari", { exact: true }).fill(`tidakada${suffix}`);
    await page.getByRole("button", { name: "Terapkan" }).click();
    await expect(page.getByText("Belum ada data.")).toBeVisible();
    await page.getByRole("link", { name: "Reset" }).click();
    await expect(page.getByLabel("Cari", { exact: true })).toHaveValue("");
  });

  test("izin staf dan 2FA tetap ditegakkan", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "cipi_session", value: fixtures.SUPPORT.token, url: baseURL! }]);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Ringkasan toko." })).toBeVisible();
    await expect(page.getByText("Pendapatan hari ini")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Produk", exact: true })).toHaveCount(0);
    await page.goto("/admin/produk", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/403/);
    await context.addCookies([{ name: "cipi_session", value: fixtures.CUSTOMER.token, url: baseURL! }]);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/403/);
    await context.addCookies([{ name: "cipi_session", value: noMfaToken, url: baseURL! }]);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/masuk\/2fa/);
  });

  for (const width of [320, 390, 768, 1440]) test(`halaman operasional responsif di ${width}px`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await context.addCookies([{ name: "cipi_session", value: fixtures.OWNER.token, url: baseURL! }]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["/admin", "/admin/pesanan", "/admin/pengiriman", "/admin/bantuan", "/admin/produk", "/admin/pengaturan"]) {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(page.locator("main h1").first()).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), path).toBe(true);
    }
    expect(errors).toEqual([]);
  });
});
