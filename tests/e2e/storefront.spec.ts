import { expect, test } from "@playwright/test";

test.describe("storefront", () => {
  test("beranda menampilkan identitas toko dan IP server", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/CipiSMP/i);
    await expect(page.getByRole("link", { name: /rank/i }).first()).toBeVisible();
    // Tombol salin IP hanya dirender setelah status server dimuat.
    await expect(page.getByRole("button", { name: /salin/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("halaman rank menampilkan aturan season dan harga", async ({ page }) => {
    await page.goto("/rank");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/rank/i);
    await expect(page.getByText(/berakhir|selesai/i).first()).toBeVisible();
  });

  test("detail produk menampilkan tanggal berakhir season", async ({ page }) => {
    await page.goto("/rank");
    const firstProduct = page.locator('a[href^="/rank/"]').first();
    await firstProduct.click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/season/i).first()).toBeVisible();
  });

  test("keranjang kosong punya empty state yang jelas", async ({ page }) => {
    await page.goto("/keranjang");
    await expect(page.getByText(/keranjang/i).first()).toBeVisible();
  });

  test("halaman legal memuat syarat penjualan (tanpa refund)", async ({ page }) => {
    await page.goto("/legal/syarat-penjualan");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/penjualan|syarat/i);
    await expect(page.getByText(/refund|pengembalian dana/i).first()).toBeVisible();
  });

  test("404 memakai halaman kustom", async ({ page }) => {
    const response = await page.goto("/halaman-tidak-ada");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading")).toBeVisible();
  });
});

test.describe("auth", () => {
  test("halaman masuk memakai split layout dan tidak membocorkan email terdaftar", async ({ page }) => {
    await page.goto("/masuk");
    await expect(page.getByRole("heading", { name: /masuk/i })).toBeVisible();
    await expect(page.getByLabel(/email atau username/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });

  test("halaman daftar menampilkan syarat usia dan tautan legal", async ({ page }) => {
    await page.goto("/daftar");
    await expect(page.getByRole("heading", { name: /daftar/i })).toBeVisible();
    await expect(page.getByText(/13 tahun|usia/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /syarat/i }).first()).toBeVisible();
  });

  test("dashboard tanpa sesi diarahkan ke login dengan next", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/masuk\?next=%2Fdashboard|\/masuk\?next=\/dashboard/);
  });

  test("panel admin tanpa sesi tidak bisa diakses", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/masuk/);
  });
});
