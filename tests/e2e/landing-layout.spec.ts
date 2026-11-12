import { expect, test } from "@playwright/test";

test.setTimeout(75_000);
const VIDEO = "https://motionbgs.com/media/2438/sunset-shader.960x540.mp4";

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`landing page rapi pada ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60000 });
    const hero = page.locator(".landing-hero");
    await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(hero.getByRole("link", { name: "Lihat rank" })).toHaveAttribute("href", "/rank");
    await expect(hero.getByRole("link", { name: "Cara bergabung" })).toHaveAttribute("href", "/cara-kerja");
    await expect(hero.locator(".brand-scene, [aria-label='Status server']")).toHaveCount(0);
    const info = page.locator("#info-server");
    await expect(info.getByText("Toko resmi")).toBeVisible();
    const status = info.getByRole("region", { name: "Status server" });
    await expect(status).toBeVisible({ timeout: 20000 });
    await expect(status.getByRole("button", { name: "Salin alamat Java" })).toBeVisible();
    await expect(status.getByRole("button", { name: "Salin alamat Bedrock" })).toBeVisible();
    await expect(info.getByText(/Pembayaran melalui Tripay atau Midtrans/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("video beranda dan fallback tetap tersedia tanpa menutupi info server", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(VIDEO, async route => { await gate; await route.abort(); });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator(".landing-hero video source")).toHaveAttribute("src", VIDEO);
  await expect(page.locator(".landing-hero video")).toHaveAttribute("loop", "");
  expect(await page.locator(".landing-hero video").evaluate((video: HTMLVideoElement) => video.muted)).toBe(true);
  release();
  await expect(page.locator(".landing-hero video")).toHaveCount(0);
  await expect(page.locator(".landing-hero__media")).toHaveCSS("background-image", /season-one-spawn\.webp/);
});

test("reduced motion tidak memuat video beranda dan alamat bisa disalin", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let requests = 0;
  page.on("request", request => { if (request.url() === VIDEO) requests++; });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.locator(".landing-hero video")).toHaveCount(0);
  const status = page.locator("#info-server").getByRole("region", { name: "Status server" });
  const java = (await status.locator("code").first().textContent())!;
  await status.getByRole("button", { name: "Salin alamat Java" }).click();
  await expect(status.getByRole("button", { name: "Tersalin" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(java);
  expect(requests).toBe(0);
});
