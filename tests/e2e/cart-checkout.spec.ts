import { expect, test, type Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(4).toString("hex");
const userId = `checkout-${suffix}`;
const cartId = `cart-${suffix}`;
const sessionToken = randomBytes(32).toString("base64url");
const buyer = `P${suffix}`;
const recipient = `R${suffix}`;
let pool: Pool;
let seasonFrozen = false;

async function requireCheckoutForm(page: Page) {
  const summary = page.getByRole("complementary", { name: "Ringkasan pesanan" });
  const unavailable = page.getByRole("heading", { name: "Belum ada metode pembayaran aktif" });
  // Streaming can render the unavailable state after goto resolves; wait for either state.
  await expect(summary.or(unavailable)).toBeVisible({ timeout: 20_000 });
  if (process.env.E2E_REQUIRE_CHECKOUT === "1") {
    await expect(summary).toBeVisible();
  } else if (await unavailable.isVisible()) {
    test.skip(true, "Tidak ada gateway pada lingkungan ini.");
  }
}
function offlineUuid(name: string) {
  const bytes = createHash("md5").update(`OfflinePlayer:${name}`).digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x30; bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

test.describe("keranjang dan checkout", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  test.skip(!enabled, "Hanya untuk database E2E disposable.");
  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const season = (await pool.query("select id, end_at, freeze_days from seasons where status='ACTIVE' limit 1")).rows[0];
    const products = (await pool.query("select id, slug from products where slug = any($1::text[])", [["star-cipi", "pop-cipi", "cipiprime"]])).rows;
    if (!season || products.length !== 3) throw new Error("Seed season dan produk diperlukan.");
    seasonFrozen = new Date(season.end_at).getTime() - Number(season.freeze_days) * 86_400_000 <= Date.now();
    const id = (slug: string) => products.find((product) => product.slug === slug)!.id;
    await pool.query("insert into users (id,email,username,display_name,password_hash,role,email_verified_at) values ($1,$2,$3,'Pemain Uji','not-used','CUSTOMER',now())", [userId, `${userId}@example.test`, `c${suffix}`]);
    await pool.query("insert into sessions (id,token_hash,user_id,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [`session-${suffix}`, createHash("sha256").update(sessionToken).digest("hex"), userId]);
    await pool.query("insert into minecraft_profiles (id,uuid,edition,display_name,user_id,verified_at,identity_verified_version) values ($1,$2,'JAVA',$3,$4,now(),2)", [`profile-${suffix}`, offlineUuid(buyer), buyer, userId]);
    await pool.query("insert into entitlements (id,uuid,product_id,season_id,source,active,player_name) values ($1,$2,$3,$4,'PURCHASE',true,$5)", [`ent-${suffix}`, offlineUuid(buyer), id("pop-cipi"), season.id, buyer]);
    await pool.query("insert into carts (id,user_id) values ($1,$2)", [cartId, userId]);
    await pool.query("insert into cart_items (id,cart_id,product_id,quantity,target_uuid,target_name,is_gift) values ($1,$2,$3,1,null,null,false),($4,$2,$5,1,null,null,false),($6,$2,$5,1,$7,$8,true)", [`rank-${suffix}`, cartId, id("star-cipi"), `kit-${suffix}`, id("cipiprime"), `gift-${suffix}`, offlineUuid(recipient), recipient]);
  });
  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from entitlements where id=$1", [`ent-${suffix}`]);
    await pool.query("delete from minecraft_profiles where id=$1", [`profile-${suffix}`]);
    await pool.query("delete from users where id=$1", [userId]);
    await pool.query("delete from products where id=$1", [`draft-${suffix}`]);
    await pool.end();
  });
  test.beforeEach(async ({ page, context, baseURL }) => {
    const previewOrigin = process.env.E2E_PREVIEW_ORIGIN;
    if (previewOrigin) {
      const origin = new URL(previewOrigin);
      await page.route("**/*", async (route) => {
        if (route.request().method() === "POST") await route.continue({ headers: { ...route.request().headers(), origin: origin.origin, "x-forwarded-host": origin.host, "x-forwarded-proto": origin.protocol.slice(0, -1) } });
        else await route.continue();
      });
    }
    await context.addCookies([{ name: "cipi_session", value: sessionToken, url: baseURL! }]);
  });

  test("menampilkan penerima, harga katalog dan perkiraan upgrade tanpa mencampur hadiah", async ({ page }) => {
    test.skip(seasonFrozen, "Season seed sedang freeze; perkiraan checkout tidak aktif.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/keranjang");
    await expect(page.getByRole("heading", { name: /Keranjangmu/ })).toBeVisible();
    await expect(page.getByText(`Hadiah untuk ${recipient}`)).toBeVisible();
    await expect(page.getByText("Subtotal harga katalog")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.goto("/checkout");
    await requireCheckoutForm(page);
    const summary = page.getByRole("complementary", { name: "Ringkasan pesanan" });
    await expect(summary.getByText(`Hadiah untuk ${recipient}`)).toBeVisible();
    await expect(summary.getByText(`Untuk ${buyer}`)).toHaveCount(2);
    await expect(summary.getByText("Belum dihitung")).toBeVisible();
    await page.getByRole("button", { name: "Cek", exact: true }).click();
    await expect(summary.getByText("Rp 140.000", { exact: true }).first()).toBeVisible();
    await expect(summary.getByText("Rp 70.000", { exact: true })).toBeVisible();
    await expect(summary.getByText("Upgrade dari Pop Cipi")).toBeVisible();
    await expect(summary.getByText("Rp 35.000", { exact: true })).toHaveCount(2);
    await page.getByLabel("Username Minecraft").fill("NamaLain");
    await expect(summary.getByText("Belum dihitung")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    if (process.env.E2E_PREVIEW_ORIGIN) await expect(page.getByRole("button", { name: /Lanjutkan pembayaran/ })).toBeDisabled();
  });

  test("kupon tidak valid tidak ditampilkan sebagai total nol", async ({ page }) => {
    test.skip(seasonFrozen, "Season seed sedang freeze.");
    await page.goto("/checkout");
    await requireCheckoutForm(page);
    const coupon = page.getByLabel(/Kode kupon/);
    if (!(await coupon.count())) test.skip(true, "Kupon dinonaktifkan.");
    await coupon.fill("KUPONTIDAKADA123");
    await page.getByRole("button", { name: "Terapkan" }).click();
    await expect(page.getByText(/Kode kupon tidak ditemukan atau sudah tidak berlaku/)).toBeVisible();
    const summary = page.getByRole("complementary", { name: "Ringkasan pesanan" });
    await expect(summary.getByText("Belum dihitung")).toBeVisible();
    await expect(summary.getByText("Rp 0", { exact: true })).toHaveCount(0);
  });

  test("respons pencarian yang terlambat tidak mengubah pemain yang baru diketik", async ({ page }) => {
    await page.goto("/checkout");
    await requireCheckoutForm(page);
    let release!: () => void;
    let intercepted!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const seen = new Promise<void>((resolve) => { intercepted = resolve; });
    await page.route("**/api/minecraft/lookup", async (route) => {
      intercepted();
      await gate;
      await route.fulfill({ json: { ok: true, player: { name: buyer, edition: "JAVA" } } });
    });
    await page.getByRole("button", { name: "Cek", exact: true }).click();
    await seen;
    await page.getByLabel("Username Minecraft").fill("PemainBaru");
    release();
    await expect(page.getByRole("complementary", { name: "Ringkasan pesanan" }).getByText("Belum dihitung")).toBeVisible();
    await expect(page.getByText(`${buyer} · Java`)).toHaveCount(0);
  });

  test("produk tidak tersedia dan hadiah tanpa penerima tidak disembunyikan", async ({ page }) => {
    await pool.query("insert into products (id,slug,type,name,tagline,description,price_idr,status) values ($1,$2,'KIT','Draft Uji','x','x',1000,'DRAFT')", [`draft-${suffix}`, `draft-${suffix}`]);
    await pool.query("insert into cart_items (id,cart_id,product_id,quantity) values ($1,$2,$3,1)", [`draft-item-${suffix}`, cartId, `draft-${suffix}`]);
    await page.goto("/keranjang");
    await expect(page.getByRole("heading", { name: "Produk tidak lagi tersedia" })).toBeVisible();
    await expect(page.getByText("Hapus produk yang tidak tersedia sebelum checkout.")).toBeVisible();
    await page.getByRole("button", { name: "Hapus produk tidak tersedia" }).click();
    await expect(page.getByRole("heading", { name: "Produk tidak lagi tersedia" })).toHaveCount(0);
    await pool.query("update cart_items set target_name=null where id=$1", [`gift-${suffix}`]);
    await page.reload();
    await expect(page.getByText("Penerima hadiah tidak tersedia")).toBeVisible();
    await expect(page.getByText("Hapus hadiah tanpa penerima dan tambahkan kembali.")).toBeVisible();
    await page.goto("/checkout");
    await expect(page.getByText("Hapus item hadiah dari keranjang dan tambahkan kembali.")).toBeVisible();
    const submit = page.getByRole("button", { name: /Lanjutkan pembayaran/ });
    if (await submit.count()) {
      await expect(submit).toBeDisabled();
      // Bypass the presentation-only disabled attribute to verify the server still rejects the broken gift.
      await page.getByLabel(/Saya menyetujui/).check();
      await page.getByLabel(/Saya paham semua pembelian/).check();
      await submit.evaluate((element) => element.removeAttribute("disabled"));
      await submit.click();
      await expect(page.getByText("Penerima hadiah tidak tersedia. Hapus item hadiah dari keranjang dan tambahkan kembali.")).toBeVisible();
    }
  });
});
