import { expect, test } from "@playwright/test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(5).toString("hex");
const userId = `journey-${suffix}`;
const otherUserId = `other-${suffix}`;
const orderId = `journey-order-${suffix}`;
const publicToken = randomBytes(24).toString("base64url");
const sessionToken = randomBytes(32).toString("base64url");
const otherSessionToken = randomBytes(32).toString("base64url");
let pool: Pool;

test.describe("timeline pesanan", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!enabled, "Butuh database E2E disposable dan E2E_ALLOW_DB_FIXTURES=1.");
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const season = (await pool.query("select id from seasons where status='ACTIVE' limit 1")).rows[0];
    const product = (await pool.query("select id from products where slug='cipiprime' limit 1")).rows[0];
    if (!season || !product) throw new Error("Seed season dan produk diperlukan.");
    await pool.query("insert into users (id,email,username,display_name,password_hash,role,email_verified_at) values ($1,$2,$3,'Uji Timeline','not-used','CUSTOMER',now())", [userId, `${userId}@example.test`, `j${suffix}`]);
    await pool.query("insert into sessions (id,token_hash,user_id,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [`session-${suffix}`, createHash("sha256").update(sessionToken).digest("hex"), userId]);
    await pool.query("insert into users (id,email,username,display_name,password_hash,role,email_verified_at) values ($1,$2,$3,'Pemain Lain','not-used','CUSTOMER',now())", [otherUserId, `${otherUserId}@example.test`, `o${suffix}`]);
    await pool.query("insert into sessions (id,token_hash,user_id,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [`other-session-${suffix}`, createHash("sha256").update(otherSessionToken).digest("hex"), otherUserId]);
    await pool.query("insert into orders (id,order_number,public_token,user_id,email,mc_uuid,mc_name,edition,season_id,status,subtotal_idr,fee_idr,total_idr,provider,expires_at) values ($1,$2,$3,$4,$5,$6,'PlayerUji','JAVA',$7,'PENDING',35000,1000,36000,'FAKE',now()+interval '1 day')", [orderId, `UJI-${suffix}`, publicToken, userId, `${userId}@example.test`, randomUUID(), season.id]);
    await pool.query("insert into order_items (id,order_id,product_id,type,name_snapshot,unit_price_idr,line_total_idr,target_uuid,target_name) values ($1,$2,$3,'KIT','CipiPrime',35000,35000,$4,'PlayerUji')", [`item-${suffix}`, orderId, product.id, randomUUID()]);
    await pool.query("insert into payments (id,order_id,provider,provider_ref,status,amount_idr,checkout_url) values ($1,$2,'FAKE',$3,'PENDING',36000,'https://example.test/bayar')", [`payment-${suffix}`, orderId, `pay-${suffix}`]);
  });
  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from orders where id=$1", [orderId]);
    await pool.query("delete from users where id = any($1::text[])", [[userId, otherUserId]]);
    await pool.end();
  });
  test.beforeEach(async ({ page }) => {
    const previewOrigin = process.env.E2E_PREVIEW_ORIGIN;
    if (previewOrigin) {
      const origin = new URL(previewOrigin);
      await page.route("**/*", async (route) => {
        if (route.request().method() === "POST") await route.continue({ headers: { ...route.request().headers(), origin: origin.origin, "x-forwarded-host": origin.host, "x-forwarded-proto": origin.protocol.slice(0, -1) } });
        else await route.continue();
      });
    }
  });

  test("berbagai status terlihat benar di halaman publik dan dashboard", async ({ page, context, baseURL }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await context.addCookies([{ name: "cipi_session", value: sessionToken, url: baseURL! }]);
    const cases = [
      { status: "PENDING", heading: "Menunggu pembayaran", current: "Menunggu pembayaran", payment: "PENDING" },
      { status: "PENDING", heading: "Pembayaran perlu diperiksa", current: "Menunggu pembayaran", payment: "UNDERPAID" },
      { status: "PAID", heading: "Pembayaran terkonfirmasi", current: "Dibayar", payment: "PAID" },
      { status: "DELIVERING", heading: "Pengiriman sedang diproses", current: "Pengiriman", payment: "PAID" },
      { status: "FAILED", heading: "Pengiriman perlu bantuan", current: "Pengiriman", payment: "PAID" },
      { status: "DELIVERED", heading: "Pesanan tercatat selesai", current: "Selesai", payment: "PAID" },
      { status: "DISPUTED", heading: "Pembayaran dalam peninjauan", current: "Dibayar", payment: "DISPUTED" },
      { status: "EXPIRED", heading: "Pesanan kedaluwarsa", current: "Menunggu pembayaran", payment: "EXPIRED" },
      { status: "CANCELLED", heading: "Pesanan dibatalkan", current: "Menunggu pembayaran", payment: "FAILED" },
    ];
    for (const entry of cases) {
      const paid = ["PAID", "DELIVERING", "FAILED", "DELIVERED", "DISPUTED"].includes(entry.status);
      await pool.query("update orders set status=$1::order_status, paid_at=case when $2 then now() else null end, delivered_at=case when $4 then now() else null end where id=$3", [entry.status, paid, orderId, ["DELIVERED", "DISPUTED"].includes(entry.status)]);
      await pool.query("update payments set status=$1 where id=$2", [entry.payment, `payment-${suffix}`]);
      for (const url of [`/pesanan/${publicToken}`, `/dashboard/pesanan/${orderId}`]) {
        await page.goto(url);
        await expect(page.getByRole("heading", { name: entry.heading, exact: true })).toBeVisible();
        const timeline = page.getByRole("region", { name: /Perjalanan pesanan/ });
        await expect(timeline.locator('li[aria-current="step"]')).toContainText(entry.current);
        if (["FAILED", "DISPUTED", "EXPIRED", "CANCELLED"].includes(entry.status) || entry.payment === "UNDERPAID") {
          await expect(timeline.locator('li[aria-current="step"]')).toContainText("Perlu perhatian");
          await expect(timeline.locator("li").last()).toContainText(entry.status === "DISPUTED" ? "Catatan sebelumnya" : "Belum sampai tahap ini");
        }
        await expect(page.getByText("CipiPrime").first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        if (entry.payment === "UNDERPAID" && url.startsWith("/pesanan/")) {
          await expect(page.getByRole("link", { name: "Buka pembayaran" })).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Batalkan pesanan" })).toHaveCount(0);
        }
      }
    }
  });

  test("pemilik dapat membatalkan pesanan menunggu tanpa melakukan pembayaran", async ({ page, context, baseURL }) => {
    await pool.query("update orders set status='PENDING', paid_at=null, delivered_at=null where id=$1", [orderId]);
    await pool.query("update payments set status='PENDING' where id=$1", [`payment-${suffix}`]);
    await page.goto(`/pesanan/${publicToken}`);
    await expect(page.getByRole("link", { name: "Buka pembayaran" })).toHaveAttribute("href", "https://example.test/bayar");
    await expect(page.getByRole("button", { name: "Batalkan pesanan" })).toHaveCount(0);
    await context.addCookies([{ name: "cipi_session", value: sessionToken, url: baseURL! }]);
    await page.reload();
    await page.getByRole("button", { name: "Batalkan pesanan" }).click();
    await expect(page.getByRole("heading", { name: "Pesanan dibatalkan" })).toBeVisible();
    await expect(page.getByRole("region", { name: /Perjalanan pesanan/ }).locator('li[aria-current="step"]')).toContainText("Perlu perhatian");
  });

  test("tautan publik salah dan pesanan akun lain tidak membuka rincian", async ({ page, context, baseURL }) => {
    await page.goto(`/pesanan/${randomUUID()}`);
    await expect(page.getByRole("heading", { name: "Halaman ini tidak ada" })).toBeVisible();
    await page.goto(`/dashboard/pesanan/${orderId}`);
    await expect(page).toHaveURL(/\/masuk/);
    await context.addCookies([{ name: "cipi_session", value: otherSessionToken, url: baseURL! }]);
    await page.goto(`/dashboard/pesanan/${orderId}`);
    await expect(page.getByRole("heading", { name: "Halaman ini tidak ada" })).toBeVisible();
    await expect(page.getByText(`UJI-${suffix}`)).toHaveCount(0);
  });
});
