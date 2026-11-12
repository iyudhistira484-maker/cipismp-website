import { expect, test } from "@playwright/test";

// Expected values are from the seeded disposable E2E catalog; no payment is made.
test.describe("detail rank dan kit", () => {
  test.beforeEach(async ({ page }) => {
    const previewOrigin = process.env.E2E_PREVIEW_ORIGIN;
    if (previewOrigin) {
      const origin = new URL(previewOrigin);
      await page.route("**/*", async (route) => {
        const request = route.request();
        if (request.method() === "POST") {
          await route.continue({ headers: { ...request.headers(), origin: origin.origin, "x-forwarded-host": origin.host, "x-forwarded-proto": origin.protocol.slice(0, -1) } });
        } else await route.continue();
      });
    }
  });

  test("rank menampilkan benefit, harga, season dan pilihan hadiah", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/rank/star-cipi");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Star Cipi");
    await expect(page.getByRole("heading", { name: /Keuntungan untukmu/ })).toBeVisible();
    await expect(page.getByText("Limit auction 30")).toBeVisible();
    const purchase = page.getByRole("complementary", { name: "Pembelian Star Cipi" });
    await expect(purchase.getByText("Rp 100.000")).toBeVisible();
    await expect(purchase.getByText(/Aktif sampai akhir Season 1/)).toBeVisible();
    const addButton = purchase.getByRole("button", { name: "Tambah ke keranjang" });
    if (!(await addButton.count())) await expect(purchase.getByText(/Pembelian ditutup|Tidak tersedia/).first()).toBeVisible();
    if (await purchase.getByLabel("Belikan untuk pemain lain").count()) {
      await purchase.getByLabel("Belikan untuk pemain lain").check();
      await expect(purchase.getByLabel("Username penerima")).toBeVisible();
    }
    const benefitTop = await page.getByRole("heading", { name: /Keuntungan untukmu/ }).evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    const purchaseTop = await purchase.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    expect(purchaseTop).toBeLessThan(benefitTop);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("isi kit dapat dibuka dengan keyboard dan produk masuk ke keranjang", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/kit/cipiprime");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("CipiPrime");
    await expect(page.getByRole("heading", { name: /Isi kit/ })).toBeVisible();
    const first = page.locator('section[aria-labelledby="isi-kit"] details').first();
    await first.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("open", "");
    await expect(first.getByText("Sharpness III")).toBeVisible();
    const purchase = page.getByRole("complementary", { name: "Pembelian CipiPrime" });
    await expect(purchase.getByText("Rp 35.000")).toBeVisible();
    await expect(purchase.getByText(/Aktif sampai akhir Season 1/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const addButton = purchase.getByRole("button", { name: "Tambah ke keranjang" });
    if (await addButton.count()) {
      await addButton.click();
      await expect(page).toHaveURL(/\/keranjang/);
      await expect(page.getByText("CipiPrime").first()).toBeVisible();
    } else {
      await expect(purchase.getByText(/Pembelian ditutup|Belum ada season aktif/).first()).toBeVisible();
    }
  });
});
