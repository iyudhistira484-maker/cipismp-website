import { expect, test } from "@playwright/test";

const VIDEO = "https://motionbgs.com/media/9266/minecraft-sunset-farm.960x540.mp4";

test.describe("panduan Cara Kerja", () => {
  test("tampilan tetap mudah dibaca di mobile dan akses panduan bekerja", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    const requests: string[] = [];
    page.on("request", (request) => { if (request.url() === VIDEO) requests.push(request.url()); });
    await page.goto("/cara-kerja");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Petualangan dimulai");
    await expect(page.locator(".guide-video video")).toHaveCount(0);
    await expect(page.locator(".guide-video")).toHaveCSS("background-image", /forest-path\.webp/);
    await expect(page.getByText(/Java dan Bedrock sama-sama perlu login/)).toBeVisible();
    await expect(page.getByText(/\/verify KODE/)).toBeVisible();
    await page.getByRole("link", { name: "Lihat panduan" }).click();
    await expect(page).toHaveURL(/#panduan/);
    await expect(page.getByRole("heading", { name: /Empat langkah/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Panduan hubungkan Minecraft/ })).toHaveAttribute("href", "/dashboard/minecraft");
    await expect(page.getByRole("button", { name: /Salin alamat Java/ })).toBeVisible();
    expect(requests).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("fallback tetap tersedia saat video gagal", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    let requests = 0;
    await page.route(VIDEO, async (route) => { requests++; await route.abort(); });
    await page.goto("/cara-kerja");
    await expect.poll(() => requests).toBe(1);
    await expect(page.locator(".guide-video video")).toHaveCount(0);
    await expect(page.locator(".guide-video")).toHaveCSS("background-image", /forest-path\.webp/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("video tidak menampilkan tombol jeda", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route(VIDEO, async (route) => { await gate; await route.abort(); });
    await page.goto("/cara-kerja", { waitUntil: "domcontentloaded" });
    const video = page.locator(".guide-video video");
    await expect(video).toHaveAttribute("src", VIDEO);
    await expect(page.getByRole("button", { name: /(?:Jeda|Putar) animasi latar/ })).toHaveCount(0);
    await expect(video).not.toHaveAttribute("controls", "");
    release();
    await expect(video).toHaveCount(0);
  });
});
