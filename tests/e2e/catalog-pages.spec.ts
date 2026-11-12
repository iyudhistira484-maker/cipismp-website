import { expect, test } from "@playwright/test";

test.setTimeout(75_000);

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const type of ["rank", "kit"] as const) {
    test(`${type} rapi pada ${width}px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`/${type}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("search").getByLabel(`Cari ${type}`)).toBeVisible();
      await expect(page.locator("#katalog article").first()).toBeVisible();
      await expect(page.locator("#katalog article").first().getByRole("link").last()).toHaveAttribute("href", new RegExp(`^/${type}/`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test("pencarian rank dan kit, hasil kosong, dan reset berfungsi", async ({ page }) => {
  for (const [type, term, name] of [["rank", "star", "Star Cipi"], ["kit", "cipiprime", "CipiPrime"]] as const) {
    await page.goto(`/${type}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const search = page.getByRole("search");
    await search.getByLabel(`Cari ${type}`).fill(term);
    await search.getByRole("button", { name: "Cari" }).click();
    await expect(page).toHaveURL(new RegExp(`/${type}\\?q=${term}`));
    await expect(page.locator("#katalog").getByRole("heading", { name })).toBeVisible();
    await search.getByLabel(`Cari ${type}`).fill("tidakmungkin123");
    await search.getByRole("button", { name: "Cari" }).click();
    await expect(page.getByText(`Tidak ada ${type} yang cocok`)).toBeVisible();
    await page.getByRole("link", { name: `Tampilkan semua ${type}` }).click();
    await expect(page).toHaveURL(new RegExp(`/${type}$`));
    await expect(page.locator("#katalog article").first()).toBeVisible();
  }
});

test("perbandingan rank dan detail kit tetap tersedia", async ({ page }) => {
  await page.goto("/rank", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.getByRole("heading", { name: /Perbandingan tier/ })).toBeVisible();
  await expect(page.getByText(/bukan berarti pasti tidak termasuk/)).toBeVisible();
  await expect(page.getByRole("region", { name: /Tabel perbandingan rank/ }).getByRole("table")).toBeVisible();
  await page.locator('#katalog a[href="/rank/star-cipi"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Star Cipi", { timeout: 20_000 });
  await page.goto("/kit", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.getByText(/cooldown 5 jam/i).first()).toBeVisible();
  await page.locator('#katalog a[href="/kit/cipiprime"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("CipiPrime", { timeout: 20_000 });
});

const RANK_VIDEO = "https://motionbgs.com/media/531/water-world-minecraft.960x540.mp4";

test("video pilihan tampil di rank, tetap ada fallback dan tidak mengubah kit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(RANK_VIDEO, async route => { await gate; await route.abort(); });
  await page.goto("/rank", { waitUntil: "domcontentloaded", timeout: 60000 });
  const video = page.locator(".rank-video video");
  await expect(video).toHaveAttribute("src", RANK_VIDEO);
  await expect(video).toHaveAttribute("loop", "");
  expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  await expect(video).not.toHaveAttribute("controls", "");
  release();
  await expect(video).toHaveCount(0);
  await expect(page.locator(".rank-video")).toHaveCSS("background-image", /forest-path\.webp/);
  await page.goto("/kit", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator(".rank-video")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("petualanganmu");
});

test("reduced motion tidak memuat video rank", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let requests = 0;
  page.on("request", request => { if (request.url() === RANK_VIDEO) requests++; });
  await page.goto("/rank", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator(".rank-video video")).toHaveCount(0);
  await expect(page.locator(".rank-video")).toHaveCSS("background-image", /forest-path\.webp/);
  await page.getByRole("link", { name: "Lihat rank", exact: true }).click();
  await expect(page).toHaveURL(/#katalog/);
  expect(requests).toBe(0);
});

const KIT_VIDEO = "https://motionbgs.com/media/1963/fireplace-in-minecraft.960x540.mp4";

test("video pilihan kit memiliki fallback dan tidak mengubah video rank", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(KIT_VIDEO, async route => { await gate; await route.abort(); });
  await page.goto("/kit", { waitUntil: "domcontentloaded", timeout: 60000 });
  const video = page.locator(".kit-video video");
  await expect(video).toHaveAttribute("src", KIT_VIDEO);
  await expect(video).toHaveAttribute("loop", "");
  expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  await expect(video).not.toHaveAttribute("controls", "");
  release();
  await expect(video).toHaveCount(0);
  await expect(page.locator(".kit-video")).toHaveCSS("background-image", /forest-path\.webp/);
  await page.goto("/rank", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator(".kit-video")).toHaveCount(0);
  await expect(page.locator(".rank-video")).toBeAttached();
});

test("reduced motion tidak memuat video kit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let requests = 0;
  page.on("request", request => { if (request.url() === KIT_VIDEO) requests++; });
  await page.goto("/kit", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator(".kit-video video")).toHaveCount(0);
  await expect(page.locator(".kit-video")).toHaveCSS("background-image", /forest-path\.webp/);
  await page.getByRole("link", { name: "Lihat kit", exact: true }).click();
  await expect(page).toHaveURL(/#katalog/);
  expect(requests).toBe(0);
});
