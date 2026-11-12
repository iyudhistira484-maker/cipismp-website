import { expect, test } from "@playwright/test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

// Fixtures only run against the explicitly opted-in disposable E2E database.
const enabled = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(5).toString("hex");
const users = [`dash-pop-${suffix}`, `dash-empty-${suffix}`];
const uuid = randomUUID();
const tokens = users.map(() => randomBytes(32).toString("base64url"));
const orderId = `dash-order-${suffix}`;
let pool: Pool;

test.describe("dashboard pemain", () => {
  test.skip(!enabled, "Set E2E_ALLOW_DB_FIXTURES=1 hanya pada database disposable.");
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const season = (await pool.query("select id from seasons where status = 'ACTIVE' limit 1")).rows[0];
    const product = (await pool.query("select id from products where slug = 'pop-cipi' limit 1")).rows[0];
    if (!season || !product) throw new Error("Seed season dan produk diperlukan pada database E2E.");
    for (const [i, id] of users.entries()) {
      await pool.query("insert into users (id,email,username,display_name,password_hash,role,email_verified_at) values ($1,$2,$3,$4,'not-used','CUSTOMER',now())", [id, `${id}@example.test`, `d${i}${suffix}`, i === 0 ? "Petualang Uji" : "Akun Baru"]);
      await pool.query("insert into sessions (id,token_hash,user_id,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [`session-${id}`, createHash("sha256").update(tokens[i]!).digest("hex"), id]);
    }
    await pool.query("insert into minecraft_profiles (id,uuid,edition,display_name,user_id,verified_at,identity_verified_version) values ($1,$2,'JAVA','PlayerUji',$3,now(),2)", [`profile-${suffix}`, uuid, users[0]]);
    await pool.query("insert into entitlements (id,uuid,product_id,season_id,source,active,player_name) values ($1,$2,$3,$4,'PURCHASE',true,'PlayerUji')", [`ent-${suffix}`, uuid, product.id, season.id]);
    await pool.query("insert into orders (id,order_number,public_token,user_id,email,mc_uuid,mc_name,edition,season_id,status,subtotal_idr,total_idr,provider,expires_at) values ($1,$2,$3,$4,$5,$6,'PlayerUji','JAVA',$7,'DELIVERED',30000,30000,'FAKE',now()+interval '1 day')", [orderId, `DASH-${suffix}`, randomUUID(), users[0], `${users[0]}@example.test`, uuid, season.id]);
  });
  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from orders where id = $1", [orderId]);
    await pool.query("delete from entitlements where id = $1", [`ent-${suffix}`]);
    await pool.query("delete from minecraft_profiles where id = any($1::text[])", [[`profile-${suffix}`, `bedrock-${suffix}`]]);
    await pool.query("delete from users where id = any($1::text[])", [users]);
    await pool.end();
  });

  test("menampilkan data pemilik dan tetap responsif di ponsel", async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.addCookies([{ name: "cipi_session", value: tokens[0]!, url: baseURL! }]);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Petualang Uji");
    await expect(page.getByRole("heading", { name: /Item aktif/ })).toBeVisible();
    await expect(page.getByText("Pop Cipi", { exact: true })).toBeVisible();
    await expect(page.getByText("PlayerUji", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`DASH-${suffix}`).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Kelola akun Minecraft/ })).toHaveAttribute("href", "/dashboard/minecraft");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("panduan Bedrock dan status kode tidak tertukar dengan akun yang sudah terhubung", async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.addCookies([{ name: "cipi_session", value: tokens[0]!, url: baseURL! }]);
    await page.goto("/dashboard/minecraft");
    await expect(page.getByRole("heading", { name: /Hubungkan akun Minecraft/ })).toBeVisible();
    await expect(page.getByText("PlayerUji", { exact: true })).toBeVisible();
    const name = `.B${suffix}`;
    await page.getByLabel("Username Minecraft").fill(name);
    await page.getByRole("button", { name: "Buat kode verifikasi" }).click();
    await expect(page.getByText("Simpan kode verifikasi")).toBeVisible();
    await expect(page.getByText(/Java dan Bedrock sama-sama perlu login/)).toBeVisible();
    const command = await page.locator("code").filter({ hasText: "/verify " }).innerText();
    const code = command.split(" ")[1]!;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    await page.getByRole("button", { name: "Cek status verifikasi" }).click();
    await expect(page.getByText(/Belum terverifikasi\. Selesaikan langkah/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    // Simulate the database result of a completed plugin verification; this is not a server runtime test.
    const hash = createHash("sha256").update(code).digest("hex");
    await pool.query("update auth_tokens set used_at = now() where token_hash = $1", [hash]);
    await pool.query("insert into minecraft_profiles (id,uuid,edition,display_name,user_id,verified_at,identity_verified_version) values ($1,$2,'BEDROCK',$3,$4,now(),2)", [`bedrock-${suffix}`, randomUUID(), name, users[0]]);
    await page.getByRole("button", { name: "Cek status verifikasi" }).click();
    await expect(page.getByText(`Terverifikasi: ${name}`)).toBeVisible();
    await expect(page.getByRole("button", { name: `Lepas tautan ${name}` })).toBeVisible();
    await page.getByRole("button", { name: `Lepas tautan ${name}` }).click();
    await expect(page.getByRole("button", { name: `Lepas tautan ${name}` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Lepas tautan PlayerUji" })).toBeVisible();
  });

  test("kode Java yang kedaluwarsa tidak dilaporkan berhasil", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "cipi_session", value: tokens[1]!, url: baseURL! }]);
    await page.goto("/dashboard/minecraft");
    await expect(page.getByText("Belum ada akun terhubung")).toBeVisible();
    await page.getByLabel("Username Minecraft").fill(`J${suffix}`);
    await page.getByRole("button", { name: "Buat kode verifikasi" }).click();
    const command = await page.locator("code").filter({ hasText: "/verify " }).innerText();
    const hash = createHash("sha256").update(command.split(" ")[1]!).digest("hex");
    await pool.query("update auth_tokens set expires_at = now() - interval '1 minute' where token_hash = $1", [hash]);
    await page.getByRole("button", { name: "Cek status verifikasi" }).click();
    await expect(page.getByText(/Kode kedaluwarsa/)).toBeVisible();
    await expect(page.getByText(/Terverifikasi:/)).toHaveCount(0);
  });

  test("akun baru mendapat empty state tanpa melihat data pemain lain", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "cipi_session", value: tokens[1]!, url: baseURL! }]);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Akun Baru");
    await expect(page.getByRole("heading", { name: "Petualangan dimulai di sini" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Belum ada pesanan" })).toBeVisible();
    await expect(page.getByText("PlayerUji", { exact: true })).toHaveCount(0);
    await expect(page.getByText(`DASH-${suffix}`)).toHaveCount(0);
  });
});
