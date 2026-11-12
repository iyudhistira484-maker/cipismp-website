import { expect, test } from "@playwright/test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(5).toString("hex");
const roles = ["OWNER", "ADMIN", "SUPPORT", "CUSTOMER"] as const;
const orderId = `admin-design-order-${suffix}`;
const ticketId = `admin-design-ticket-${suffix}`;
const fixtures = Object.fromEntries(roles.map((role) => [role, { id: `admin-design-${role.toLowerCase()}-${suffix}`, token: randomBytes(32).toString("base64url") }])) as Record<(typeof roles)[number], { id: string; token: string }>;
const noMfaToken = randomBytes(32).toString("base64url");
let pool: Pool;

test.describe("tampilan dan akses panel admin", () => {
  test.skip(!enabled, "Hanya untuk database E2E disposable.");
  test.setTimeout(120_000);
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    for (const role of roles) {
      const fixture = fixtures[role];
      await pool.query("insert into users (id,email,username,display_name,password_hash,role,email_verified_at,totp_enabled_at) values ($1,$2,$3,$4,'unused',$5,now(),case when $6::boolean then now() else null end)", [fixture.id, `${fixture.id}@example.test`, `${role.toLowerCase()}${suffix}`, `Uji ${role}`, role, role !== "CUSTOMER"]);
      await pool.query("insert into sessions (id,token_hash,user_id,mfa_satisfied_at,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now(),now()+interval '1 hour',now()+interval '1 hour')", [`session-${fixture.id}`, createHash("sha256").update(fixture.token).digest("hex"), fixture.id]);
    }
    await pool.query("insert into sessions (id,token_hash,user_id,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [`no-mfa-${suffix}`, createHash("sha256").update(noMfaToken).digest("hex"), fixtures.OWNER.id]);
    const season = (await pool.query("select id from seasons where status='ACTIVE' limit 1")).rows[0];
    if (!season) throw new Error("Season uji tidak tersedia");
    await pool.query("insert into orders (id,order_number,public_token,user_id,email,mc_uuid,mc_name,edition,season_id,status,subtotal_idr,fee_idr,total_idr,provider,expires_at) values ($1,$2,$3,$4,$5,$6,'PemainUji','JAVA',$7,'PENDING',35000,0,35000,'FAKE',now()+interval '1 day')", [orderId, `CIPS-${suffix.slice(0, 8).toUpperCase()}`, randomBytes(24).toString("base64url"), fixtures.CUSTOMER.id, `${fixtures.CUSTOMER.id}@example.test`, randomUUID(), season.id]);
    await pool.query("insert into support_tickets (id,user_id,order_id,subject) values ($1,$2,$3,$4)", [ticketId, fixtures.CUSTOMER.id, orderId, `Bantuan uji ${suffix}`]);
    await pool.query("insert into support_messages (id,ticket_id,author_id,author_role,body) values ($1,$2,$3,'CUSTOMER','Pesan bantuan contoh')", [`message-${suffix}`, ticketId, fixtures.CUSTOMER.id]);
  });
  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from notifications where href=any($1::text[])", [[`/admin/bantuan/${ticketId}`, `/dashboard/bantuan/${ticketId}`]]);
    await pool.query("delete from audit_logs where target_id=$1", [ticketId]);
    await pool.query("delete from support_tickets where id=$1", [ticketId]);
    await pool.query("delete from orders where id=$1", [orderId]);
    await pool.query("delete from users where id=any($1::text[])", [roles.map((role) => fixtures[role].id)]);
    await pool.end();
  });

  test("menu mobile terkelompok, navigasi dan filter pesanan berfungsi", async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await context.addCookies([{ name: "cipi_session", value: fixtures.OWNER.token, url: baseURL! }]);
    await page.goto("/admin", { waitUntil: "load", timeout: 60_000 });
    await expect(page.locator("main h1")).toBeVisible({ timeout: 30_000 });
    const menu = page.getByRole("button", { name: /Menu Ringkasan/ });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    const navigation = page.getByRole("navigation", { name: "Navigasi admin" });
    await expect(navigation.getByText("Toko & konten")).toBeVisible();
    await navigation.getByRole("link", { name: "Pesanan", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pesanan/);
    await expect(page.getByRole("heading", { name: "Pesanan.", exact: true })).toBeVisible({ timeout: 30_000 });
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
    await context.addCookies([{ name: "cipi_session", value: fixtures.ADMIN.token, url: baseURL! }]);
    await page.goto("/admin/pembayaran", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Rincian pembayaran menunggu, ringkasan webhook, dan uji kesiapan gateway hanya tersedia untuk Owner.")).toBeVisible();
    await page.goto("/admin/staf", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/403/);
    await context.addCookies([{ name: "cipi_session", value: fixtures.CUSTOMER.token, url: baseURL! }]);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/403/);
    await context.addCookies([{ name: "cipi_session", value: noMfaToken, url: baseURL! }]);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/masuk\/2fa/);
  });

  test("form sensitif dan panduan server tetap jelas", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "cipi_session", value: fixtures.OWNER.token, url: baseURL! }]);
    await page.goto("/admin/season", { waitUntil: "load" });
    await expect(page.getByLabel("Simulasi (tidak mengubah season atau entitlement)")).toBeChecked();
    await expect(page.getByLabel('Ketik "AKHIRI SEASON"')).toHaveCount(0);
    await page.getByLabel("Eksekusi sungguhan").check();
    await expect(page.getByLabel('Ketik "AKHIRI SEASON"')).toBeVisible();
    await page.goto("/admin/server", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Pada mode server offline CipiSMP, pengiriman melalui RCON ditahan/)).toBeVisible();
    await expect(page.getByText(/Check-in saja bukan bukti/)).toBeVisible();
    await page.goto("/admin/kupon", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Buat kupon" })).toBeVisible();
    await page.goto("/admin/diskon", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Buat diskon" })).toBeVisible();
  });

  test("staf dapat membalas dan menutup bantuan uji", async ({ page, context, baseURL }) => {
    const previewOrigin = process.env.E2E_PREVIEW_ORIGIN;
    if (previewOrigin) {
      const origin = new URL(previewOrigin);
      await page.route("**/*", async (route) => {
        if (route.request().method() === "POST") await route.continue({ headers: { ...route.request().headers(), origin: origin.origin, "x-forwarded-host": origin.host, "x-forwarded-proto": origin.protocol.slice(0, -1) } });
        else await route.continue();
      });
    }
    await context.addCookies([{ name: "cipi_session", value: fixtures.SUPPORT.token, url: baseURL! }]);
    await page.goto(`/admin/bantuan/${ticketId}`, { waitUntil: "load" });
    await expect(page.getByText("Pesan bantuan contoh")).toBeVisible();
    await page.getByLabel("Tulis balasan").fill("Balasan staf untuk data uji.");
    await page.getByRole("button", { name: "Kirim balasan" }).click();
    await expect(page.getByText("Balasan staf untuk data uji.")).toBeVisible({ timeout: 25_000 });
    await page.getByRole("button", { name: "Tutup permintaan" }).click();
    await expect(page.getByText("Permintaan sudah ditutup.")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByLabel("Tulis balasan")).toHaveCount(0);
  });

  for (const width of [320, 390, 768, 1440]) test(`halaman operasional responsif di ${width}px`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await context.addCookies([{ name: "cipi_session", value: fixtures.OWNER.token, url: baseURL! }]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["/admin", "/admin/pesanan", `/admin/pesanan/${orderId}`, "/admin/pengiriman", "/admin/bantuan", `/admin/bantuan/${ticketId}`, "/admin/notifikasi", "/admin/pelanggan", `/admin/pelanggan/${fixtures.CUSTOMER.id}`, "/admin/produk", "/admin/season", "/admin/ulasan", "/admin/kupon", "/admin/diskon", "/admin/pembayaran", "/admin/pengaturan", "/admin/server", "/admin/staf", "/admin/audit", "/admin/profil", "/admin/keamanan"]) {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(page.locator("main h1").first()).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), path).toBe(true);
    }
    expect(errors).toEqual([]);
  });
});
