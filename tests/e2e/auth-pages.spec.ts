import { expect, test } from "@playwright/test";

const VIDEO = "https://motionbgs.com/media/2978/minecraft-sunset.960x540.mp4";

test.describe("halaman akun dengan latar video", () => {
  test("halaman masuk dan daftar tetap responsif dan formulir dapat digunakan", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/masuk");
    await expect(page.getByRole("heading", { name: /Masuk ke CipiSMP/ })).toBeVisible();
    await expect(page.getByLabel("Email atau username")).toBeVisible();
    await page.getByRole("button", { name: "Tampilkan password" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await page.getByRole("link", { name: "Daftar", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Buat akun CipiSMP/ })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Buat akun" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole("link", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL(/\/masuk/);
  });

  test("reduced motion tidak memuat video dan tidak ada tombol video", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    let requests = 0;
    await page.route(VIDEO, async (route) => { requests++; await route.abort(); });
    await page.goto("/daftar");
    await expect(page.locator(".auth-scene__video")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /jeda video|putar video/i })).toHaveCount(0);
    expect(requests).toBe(0);
  });

  test("teks kiri tetap terlihat saat formulir daftar di-scroll pada desktop", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/daftar");
    const story = page.locator(".auth-story");
    await expect(story).toHaveCSS("position", "sticky");
    await page.evaluate(() => window.scrollTo(0, 180));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    const firstTop = await story.evaluate((element) => element.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, 260));
    const secondTop = await story.evaluate((element) => element.getBoundingClientRect().top);
    expect(Math.abs(secondTop - firstTop)).toBeLessThan(2);
    expect(secondTop).toBeGreaterThanOrEqual(30);
    await expect(page.getByRole("button", { name: "Buat akun" })).toBeVisible();
  });

  test("fallback tetap tampil saat host video gagal", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    let requests = 0;
    await page.route(VIDEO, async (route) => { requests++; await route.abort(); });
    await page.goto("/masuk");
    await expect.poll(() => requests).toBe(1);
    await expect(page.locator(".auth-scene__video")).toHaveCount(0);
    await expect(page.locator(".auth-scene__visual")).toHaveCSS("background-image", /season-one-spawn\.webp/);
    await expect(page.getByRole("button", { name: /jeda video|putar video/i })).toHaveCount(0);
  });
});
