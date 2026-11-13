import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

// This suite changes a global discount; run it alone with a dedicated disposable database.
const enabled = process.env.E2E_ISOLATED_PROMO === "1" && process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL) && (process.env.EMAIL_PROVIDER ?? "outbox") === "outbox" && process.env.APP_ENV !== "production";
const suffix = randomBytes(5).toString("hex");
const userId = `promo-owner-${suffix}`;
const cartId = `promo-cart-${suffix}`;
const token = randomBytes(32).toString("base64url");
const discountId = `promo-${suffix}`;
let pool: Pool;

test.describe("promo, email dan zona waktu", () => {
  test.skip(!enabled, "Perlu E2E_ISOLATED_PROMO=1 dan database disposable khusus yang di-seed.");
  test.use({ timezoneId: "Pacific/Honolulu" });
  test.setTimeout(120_000);
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const season = (await pool.query("SELECT id FROM seasons WHERE status='ACTIVE' LIMIT 1")).rows[0];
    const products = (await pool.query("SELECT id, slug FROM products WHERE slug=ANY($1::text[])", [["pop-cipi", "cipiprime"]])).rows;
    if (!season || products.length !== 2) throw new Error("Season dan produk seed diperlukan.");
    const rank = products.find((p) => p.slug === "pop-cipi").id;
    const kit = products.find((p) => p.slug === "cipiprime").id;
    await pool.query("INSERT INTO users (id,email,username,display_name,password_hash,role,email_verified_at,totp_enabled_at) VALUES ($1,$2,$3,'Owner Uji','unused','OWNER',now(),now())", [userId, `${userId}@example.test`, `promo${suffix}`]);
    await pool.query("INSERT INTO sessions (id,token_hash,user_id,mfa_satisfied_at,absolute_expires_at,idle_expires_at) VALUES ($1,$2,$3,now(),now()+interval '1 hour',now()+interval '1 hour')", [`session-${suffix}`, createHash("sha256").update(token).digest("hex"), userId]);
    await pool.query("INSERT INTO carts (id,user_id) VALUES ($1,$2)", [cartId, userId]);
    await pool.query("INSERT INTO cart_items (id,cart_id,product_id,quantity,is_gift) VALUES ($1,$2,$3,1,false),($4,$2,$5,1,false)", [`rank-${suffix}`, cartId, rank, `kit-${suffix}`, kit]);
    await pool.query("INSERT INTO automatic_discounts (id,name,type,value,season_id,rank_only,eligible_items_only) VALUES ($1,$2,'PERCENT',20,$3,true,true)", [discountId, `Promo Uji ${suffix}`, season.id]);
  });
  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM automatic_discounts WHERE id=$1", [discountId]);
    await pool.query("DELETE FROM jobs WHERE payload->>'emailId' IN (SELECT id FROM email_outbox WHERE \"to\"=$1)", [`new-${suffix}@example.test`]);
    await pool.query("DELETE FROM email_outbox WHERE \"to\"=$1", [`new-${suffix}@example.test`]);
    await pool.query("DELETE FROM users WHERE id=$1", [userId]);
    await pool.end();
  });

  test("katalog dan keranjang menampilkan promo, checkout menghitung ulang, email outbox jujur dan tanggal stabil", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "cipi_session", value: token, url: baseURL! }]);
    await page.goto("/rank");
    const rank = page.locator("article").filter({ has: page.getByRole("heading", { name: "Pop Cipi", exact: true }) });
    await expect(rank.getByText("Rp 30.000", { exact: true })).toBeVisible();
    await expect(rank.getByText("Rp 24.000", { exact: false })).toBeVisible();
    await expect(rank.getByText(`Promo otomatis: Promo Uji ${suffix} · perkiraan`)).toBeVisible();
    await page.goto("/kit");
    const kit = page.locator("article").filter({ has: page.getByRole("heading", { name: "CipiPrime", exact: true }) });
    await expect(kit.getByText("Rp 35.000", { exact: false })).toBeVisible();
    await expect(kit.getByText(/Promo otomatis/)).toHaveCount(0);
    await page.goto("/keranjang");
    await expect(page.getByText("Rp 65.000", { exact: true })).toBeVisible();
    await expect(page.getByText("−Rp 6.000", { exact: true })).toBeVisible();
    await expect(page.getByText("Rp 59.000", { exact: true })).toBeVisible();
    await page.goto("/checkout");
    const summary = page.getByRole("complementary", { name: "Ringkasan pesanan" });
    const noGateway = page.getByRole("heading", { name: "Belum ada metode pembayaran aktif" });
    await expect(summary.or(noGateway)).toBeVisible();
    if (process.env.E2E_REQUIRE_CHECKOUT === "1") await expect(summary).toBeVisible();
    if (await summary.isVisible()) {
      await page.getByLabel("Username Minecraft").fill(`Uji${suffix.slice(0, 6)}`);
      await page.getByRole("button", { name: "Cek", exact: true }).click();
      await expect(summary.getByText("Rp 59.000", { exact: true })).toBeVisible();
      await expect(summary.getByText(/6\.000/)).toBeVisible();
    }

    // The same rule can target kits instead; it must not discount rank cards.
    await pool.query("UPDATE automatic_discounts SET rank_only=false, kit_only=true WHERE id=$1", [discountId]);
    await page.goto("/kit");
    await expect(kit.getByText("Rp 28.000", { exact: false })).toBeVisible();
    await expect(kit.getByText(`Promo otomatis: Promo Uji ${suffix} · perkiraan`)).toBeVisible();
    await page.goto("/rank");
    await expect(rank.getByText(/Promo otomatis/)).toHaveCount(0);
    await page.goto("/keranjang");
    await expect(page.getByText("−Rp 7.000", { exact: true })).toBeVisible();
    await expect(page.getByText("Rp 58.000", { exact: true })).toBeVisible();
    await pool.query("UPDATE automatic_discounts SET active=false WHERE id=$1", [discountId]);
    await page.reload();
    await expect(page.getByText(/Perkiraan promo otomatis/)).toHaveCount(0);

    const hydrationErrors: string[] = [];
    page.on("pageerror", (error) => { if (/hydrat|server rendered/i.test(error.message)) hydrationErrors.push(error.message); });
    await page.goto("/admin/season", { waitUntil: "load" });
    await expect(page.getByLabel("Season yang diakhiri").locator("option").first()).toContainText("14 Januari 2027");
    await page.waitForTimeout(1000);
    expect(hydrationErrors).toEqual([]);

    await page.goto("/admin/keamanan", { waitUntil: "load" });
    await page.getByLabel("Email baru").fill(`new-${suffix}@example.test`);
    await page.getByRole("button", { name: "Kirim tautan konfirmasi" }).click();
    await expect(page.getByText(/Mode email uji \(outbox\)/)).toBeVisible();
    await expect(page.getByText("Tautan konfirmasi dikirim ke email baru.")).toHaveCount(0);
    await expect.poll(async () => Number((await pool.query("SELECT count(*) FROM email_outbox WHERE \"to\"=$1", [`new-${suffix}@example.test`])).rows[0].count)).toBe(1);
  });
});
