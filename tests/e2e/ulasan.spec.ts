import { expect, test } from "@playwright/test";

test.setTimeout(75_000);

for (const width of [320, 390, 1440]) {
  test(`halaman ulasan responsif pada ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/ulasan", { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Pengalaman pembeli/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rating pemain" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Masuk ke akun" })).toHaveAttribute("href", "/masuk?next=%2Fulasan");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("tautan dan keadaan kosong ulasan bekerja", async ({ page }) => {
  await page.goto("/ulasan", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.getByRole("heading", { name: /Cerita dari komunitas/ })).toBeVisible();
  await page.getByRole("link", { name: "Lihat ulasan", exact: true }).click();
  await expect(page).toHaveURL(/#pengalaman-pembeli/);
  if (await page.getByText("0 ulasan publik").count()) {
    await expect(page.getByRole("heading", { name: "Belum ada ulasan yang tampil" })).toBeVisible();
    await expect(page.getByText("Belum ada rating")).toBeVisible();
  } else {
    await expect(page.locator("#pengalaman-pembeli li").first()).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Lihat cara kerja" })).toHaveAttribute("href", "/cara-kerja");
});

// Fixture data is only created when explicitly opted in on a disposable database.
test("ulasan publik dan ulasan pribadi menampilkan status yang benar", async ({ page, context, baseURL }) => {
  test.skip(process.env.E2E_ALLOW_DB_FIXTURES !== "1" || !process.env.DATABASE_URL, "Memerlukan database preview disposable.");
  const { Pool } = await import("pg");
  const { randomBytes, createHash } = await import("node:crypto");
  const suffix = randomBytes(4).toString("hex");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const owner = `review-owner-${suffix}`;
  const author = `review-author-${suffix}`;
  const token = randomBytes(32).toString("base64url");
  const bodyPublic = `Cerita publik ${suffix} yang telah disetujui.`;
  const bodyPrivate = `Cerita pribadi ${suffix} menunggu moderasi.`;
  try {
    const product = (await pool.query("select id from products where slug='cipiprime' and status='PUBLISHED' limit 1")).rows[0];
    if (!product) throw new Error("Produk seed diperlukan");
    await pool.query("insert into users (id,email,username,display_name,password_hash,role,email_verified_at) values ($1,$2,$3,'Pemilik Uji','unused','CUSTOMER',now()),($4,$5,$6,'Pemain Uji','unused','CUSTOMER',now())", [owner, `${owner}@example.test`, `o${suffix}`, author, `${author}@example.test`, `a${suffix}`]);
    await pool.query("insert into sessions (id,token_hash,user_id,absolute_expires_at,idle_expires_at) values ($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [`session-${suffix}`, createHash("sha256").update(token).digest("hex"), owner]);
    await pool.query("insert into reviews (id,product_id,user_id,rating,body,status) values ($1,$2,$3,5,$4,'APPROVED'),($5,$2,$6,3,$7,'PENDING')", [`review-public-${suffix}`, product.id, author, bodyPublic, `review-private-${suffix}`, owner, bodyPrivate]);
    await page.goto("/ulasan", { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page.getByText(bodyPublic)).toBeVisible();
    await expect(page.getByText(bodyPrivate)).toHaveCount(0);
    await expect(page.getByText("Pemain Uji", { exact: true })).toHaveCount(0);
    await context.addCookies([{ name: "cipi_session", value: token, url: baseURL! }]);
    await page.reload();
    const own = page.getByRole("region", { name: /Ulasan saya/ });
    await expect(own.locator("p").filter({ hasText: bodyPrivate })).toBeVisible();
    await expect(own.getByText("Menunggu", { exact: true })).toBeVisible();
    await own.getByText("Edit ulasan saya").click();
    await expect(own.locator('textarea[name="body"]')).toHaveValue(bodyPrivate);
    await expect(page.getByText(bodyPublic)).toBeVisible();
  } finally {
    await pool.query("delete from users where id=any($1::text[])", [[owner, author]]);
    await pool.end();
  }
});

const VIDEO = "https://motionbgs.com/media/3071/minecraft-rainy-landscape.960x540.mp4";

test("video ulasan menggunakan sumber pilihan dan fallback ketika gagal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(VIDEO, async (route) => { await gate; await route.abort(); });
  await page.goto("/ulasan", { waitUntil: "domcontentloaded", timeout: 60000 });
  const video = page.locator(".reviews-video video");
  await expect(video).toHaveAttribute("src", VIDEO);
  await expect(video).toHaveAttribute("loop", "");
  expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  await expect(video).not.toHaveAttribute("controls", "");
  release();
  await expect(video).toHaveCount(0);
  await expect(page.locator(".reviews-video")).toHaveCSS("background-image", /forest-path\.webp/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("reduced motion tidak memuat video ulasan", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [];
  page.on("request", request => { if (request.url() === VIDEO) requests.push(request.url()); });
  await page.goto("/ulasan", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator(".reviews-video video")).toHaveCount(0);
  await expect(page.locator(".reviews-video")).toHaveCSS("background-image", /forest-path\.webp/);
  await page.getByRole("link", { name: "Lihat ulasan", exact: true }).click();
  await expect(page).toHaveURL(/#pengalaman-pembeli/);
  expect(requests).toHaveLength(0);
});
