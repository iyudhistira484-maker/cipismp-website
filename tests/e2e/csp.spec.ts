import { expect, test } from "@playwright/test";

test("halaman dinamis memakai nonce CSP yang cocok dan dapat dihidrasi", async ({ page }) => {
  for (const path of ["/403", "/lupa-password", "/legal/syarat-penjualan", "/halaman-tidak-ada-uji-csp"]) {
    const violations: string[] = [];
    const listener = (message: { type(): string; text(): string }) => {
      if (message.type() === "error" && message.text().includes("Content Security Policy") && message.text().includes("script-src")) violations.push(message.text());
    };
    page.on("console", listener);
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    const csp = response!.headers()["content-security-policy"] ?? "";
    const nonce = response!.headers()["x-nonce"] ?? "";
    expect(nonce).not.toBe("");
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(await page.locator("script[src]").first().evaluate((el) => (el as HTMLScriptElement).nonce)).toBe(nonce);
    expect(violations).toEqual([]);
    page.off("console", listener);
  }
});
