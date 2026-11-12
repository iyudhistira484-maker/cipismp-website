import { expect, test } from "@playwright/test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

test.setTimeout(90_000);
const fixtures = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(4).toString("hex");
const userId = `design-user-${suffix}`;
const otherId = `design-other-${suffix}`;
const orderId = `design-order-${suffix}`;
const orderNumber = `CIPS-${suffix.toUpperCase()}`;
const email = `${userId}@example.test`;
const token = randomBytes(24).toString("base64url");
const userSession = randomBytes(32).toString("base64url");
const otherSession = randomBytes(32).toString("base64url");
let pool: Pool;
let ticketId = "";

test.describe("status pesanan, bantuan dan pengaturan akun", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!fixtures, "Butuh database E2E disposable.");
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const season = (await pool.query("select id from seasons where status='ACTIVE' limit 1")).rows[0];
    if (!season) throw new Error("Season uji tidak tersedia");
    await pool.query("insert into users (id,email,username,display_name,password_hash,role,email_verified_at) values ($1,$2,$3,'Pemain Uji','unused','CUSTOMER',now()),($4,$5,$6,'Pemain Lain','unused','CUSTOMER',now())", [userId, email, `u${suffix}`, otherId, `${otherId}@example.test`, `o${suffix}`]);
    for (const [id, value, user] of [[`ses-user-${suffix}`, userSession, userId], [`ses-other-${suffix}`, otherSession, otherId]]) await pool.query("insert into sessions (id,token_hash,user_id,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [id, createHash("sha256").update(value!).digest("hex"), user]);
    await pool.query("insert into orders (id,order_number,public_token,user_id,email,mc_uuid,mc_name,edition,season_id,status,subtotal_idr,fee_idr,total_idr,provider,expires_at) values ($1,$2,$3,$4,$5,$6,'PemainUji','JAVA',$7,'PENDING',35000,0,35000,'FAKE',now()+interval '1 day')", [orderId, orderNumber, token, userId, email, randomUUID(), season.id]);
  });
  test.afterAll(async () => {
    if (!pool) return;
    if (ticketId) await pool.query("delete from notifications where href=any($1::text[])", [[`/admin/bantuan/${ticketId}`, `/dashboard/bantuan/${ticketId}`]]);
    await pool.query("delete from orders where id=$1", [orderId]);
    await pool.query("delete from users where id=any($1::text[])", [[userId, otherId]]);
    await pool.end();
  });
  test.beforeEach(async ({ page }) => {
    const previewOrigin = process.env.E2E_PREVIEW_ORIGIN;
    if (previewOrigin) {
      const origin = new URL(previewOrigin);
      await page.route("**/*", async route => {
        if (route.request().method() === "POST") await route.continue({ headers: { ...route.request().headers(), origin: origin.origin, "x-forwarded-host": origin.host, "x-forwarded-proto": origin.protocol.slice(0, -1) } });
        else await route.continue();
      });
    }
  });

  test("pencarian pesanan memerlukan nomor dan email yang cocok", async ({ page }) => {
    await page.goto("/status-pesanan", { waitUntil: "load" });
    await page.getByLabel("Nomor order").fill(orderNumber);
    await page.getByLabel("Email pembelian").fill(`wrong-${suffix}@example.test`);
    await page.getByRole("button", { name: "Buka pesanan" }).click();
    await expect(page.getByText("Pesanan tidak ditemukan", { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/status-pesanan/);
    await expect(page.getByLabel("Nomor order")).toHaveValue(orderNumber);
    await page.getByLabel("Email pembelian").fill(email);
    await page.getByRole("button", { name: "Buka pesanan" }).click();
    await expect(page).toHaveURL(new RegExp(`/pesanan/${token}`), { timeout: 25_000 });
    await expect(page.getByText(orderNumber).first()).toBeVisible();
  });

  test("bantuan dibuat, dibalas, dan tidak dapat dilihat akun lain", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "cipi_session", value: userSession, url: baseURL! }]);
    await page.goto(`/dashboard/bantuan?order=${orderId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Pesanan terkait")).toHaveValue(orderId);
    await page.getByLabel("Judul").fill(`Pertanyaan uji ${suffix}`);
    await page.getByLabel("Ceritakan kendalanya").fill("Mohon bantu memeriksa pesanan contoh saya.");
    await page.getByRole("button", { name: "Kirim permintaan" }).click();
    await expect(page).toHaveURL(/\/dashboard\/bantuan\/spt_/, { timeout: 25_000 });
    ticketId = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.getByRole("region", { name: "Percakapan" }).getByText("Mohon bantu memeriksa pesanan contoh saya.")).toBeVisible();
    await page.getByLabel("Tulis balasan").fill("Ini balasan untuk percakapan uji.");
    await page.getByRole("button", { name: "Kirim balasan" }).click();
    await expect(page.getByText("Ini balasan untuk percakapan uji.")).toBeVisible({ timeout: 25_000 });
    await context.addCookies([{ name: "cipi_session", value: otherSession, url: baseURL! }]);
    await page.goto(`/dashboard/bantuan/${ticketId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Mohon bantu memeriksa pesanan contoh saya.")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Halaman ini tidak ada" })).toBeVisible();
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`status dan akun tetap rapi pada ${width}px`, async ({ page, context, baseURL }) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await context.addCookies([{ name: "cipi_session", value: userSession, url: baseURL! }]);
      for (const path of ["/status-pesanan", "/dashboard/bantuan", "/dashboard/profil", "/dashboard/notifikasi", "/dashboard/keamanan"]) {
        await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60000 });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), path).toBe(true);
      }
      await expect(page.getByLabel("Password saat ini")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Autentikasi dua faktor/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sesi aktif" })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
