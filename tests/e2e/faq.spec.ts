import { expect, test } from "@playwright/test";

const questions = [
  "Apa yang terjadi pada rank saya saat season berakhir?",
  "Bagaimana cara upgrade rank?",
  "Saya main dari HP atau konsol. Bisa beli?",
  "Bisa membeli untuk teman?",
  "Berapa lama akses rank atau kit aktif setelah saya bayar?",
  "Sudah bayar tapi akses atau reward belum aktif. Apa yang harus saya lakukan?",
  "Metode pembayaran apa yang tersedia?",
  "Bisa refund kalau berubah pikiran?",
];

test("FAQ mengelompokkan semua pertanyaan dan navigasi topik berfungsi", async ({ page }) => {
  await page.goto("/faq");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ada pertanyaan?");
  for (const question of questions) await expect(page.getByRole("button", { name: question })).toBeVisible();
  await page.getByRole("link", { name: "Pemain & pengiriman" }).click();
  await expect(page).toHaveURL(/#pemain-dan-pengiriman/);
  await expect(page.getByRole("heading", { name: "Pemain & pengiriman" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cara kerja" }).last()).toHaveAttribute("href", "/cara-kerja");
  await expect(page.getByRole("link", { name: "Syarat penjualan" }).last()).toHaveAttribute("href", "/legal/syarat-penjualan");
  await expect(page.locator('aside a[href^="mailto:"]')).toBeVisible();
  await expect(page.getByText(/tidak pernah meminta password/)).toBeVisible();
});

test("accordion mendukung keyboard dan jawaban mengikuti alur server", async ({ page }) => {
  await page.goto("/faq");
  const bedrock = page.getByRole("button", { name: questions[2] });
  await bedrock.focus();
  await page.keyboard.press("Enter");
  await expect(bedrock).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/Java dan Bedrock sama-sama perlu login/)).toBeVisible();
  const hadiah = page.getByRole("button", { name: questions[3] });
  await hadiah.click();
  await expect(bedrock).toHaveAttribute("aria-expanded", "false");
  await expect(hadiah).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/Jika fitur hadiah diaktifkan/)).toBeVisible();
  await hadiah.press("Space");
  await expect(hadiah).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: questions[4] }).click();
  await expect(page.getByText(/Waktu pengiriman dapat bervariasi/)).toBeVisible();
});

for (const width of [320, 390, 1440]) {
  test(`FAQ responsif pada ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/faq");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

const FAQ_VIDEO = "https://motionbgs.com/media/3761/christmas-in-minecraft.960x540.mp4";

test("video FAQ mengikuti reduced motion dan mempertahankan tautan topik", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url() === FAQ_VIDEO) requests.push(request.url()); });
  await page.goto("/faq");
  await expect(page.locator(".faq-video video")).toHaveCount(0);
  await expect(page.locator(".faq-video")).toHaveCSS("background-image", /forest-path\.webp/);
  await page.getByRole("link", { name: "Pembayaran & refund" }).click();
  await expect(page).toHaveURL(/#pembayaran-dan-refund/);
  expect(requests).toHaveLength(0);
});

test("video FAQ memakai sumber pilihan dan fallback saat gagal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(FAQ_VIDEO, async (route) => { await gate; await route.abort(); });
  await page.goto("/faq", { waitUntil: "domcontentloaded" });
  const video = page.locator(".faq-video video");
  await expect(video).toHaveAttribute("src", FAQ_VIDEO);
  await expect(video).toHaveAttribute("loop", "");
  expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  await expect(video).not.toHaveAttribute("controls", "");
  release();
  await expect(video).toHaveCount(0);
  await expect(page.locator(".faq-video")).toHaveCSS("background-image", /forest-path\.webp/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
