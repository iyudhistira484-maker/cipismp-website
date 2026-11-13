import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.E2E_ALLOW_DB_FIXTURES === "1" && Boolean(process.env.DATABASE_URL);
const suffix = randomBytes(5).toString("hex");
const ownerId = `announcement-owner-${suffix}`;
const token = randomBytes(32).toString("base64url");
const announcement = `Pengumuman uji ${suffix}`;
let pool: Pool;
let originalAnnouncement: string | null = null;
let originalUpdatedBy: string | null = null;

test.describe("pengumuman toko", () => {
  test.skip(!enabled, "Hanya untuk database E2E disposable.");
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const settings = await pool.query("SELECT value->'site'->>'announcement' AS announcement, updated_by FROM settings WHERE key='store.settings'");
    if (settings.rowCount !== 1) throw new Error("Pengaturan uji belum di-seed.");
    originalAnnouncement = settings.rows[0].announcement;
    originalUpdatedBy = settings.rows[0].updated_by;
    await pool.query("INSERT INTO users (id,email,username,display_name,password_hash,role,email_verified_at,totp_enabled_at) VALUES ($1,$2,$3,'Owner uji','unused','OWNER',now(),now())", [ownerId, `${ownerId}@example.test`, `ann${suffix}`]);
    await pool.query("INSERT INTO sessions (id,token_hash,user_id,mfa_satisfied_at,absolute_expires_at,idle_expires_at) VALUES ($1,$2,$3,now(),now()+interval '1 hour',now()+interval '1 hour')", [`session-${ownerId}`, createHash("sha256").update(token).digest("hex"), ownerId]);
  });

  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("UPDATE settings SET value=jsonb_set(value,'{site,announcement}',$1::jsonb,true), updated_by=$2 WHERE key='store.settings'", [JSON.stringify(originalAnnouncement), originalUpdatedBy]);
    await pool.query("DELETE FROM audit_logs WHERE actor_id=$1", [ownerId]);
    await pool.query("DELETE FROM users WHERE id=$1", [ownerId]);
    await pool.end();
  });

  test("ditampilkan saat disimpan dan hilang setelah dikosongkan", async ({ page, context, browser, baseURL }) => {
    await context.addCookies([{ name: "cipi_session", value: token, url: baseURL! }]);
    await page.goto("/admin/pengaturan", { waitUntil: "load" });
    const input = page.getByLabel("Pengumuman di atas situs");
    const save = page.getByRole("button", { name: "Simpan identitas" });
    const originalOtherSettings = (await pool.query("SELECT value #- '{site,announcement}' AS other FROM settings WHERE key='store.settings'")).rows[0].other;
    const shopper = await browser.newPage({ baseURL });
    try {
      // Prime a separate storefront render before the admin changes the value.
      await shopper.goto("/", { waitUntil: "load" });
      await input.fill(announcement);
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/admin/pengaturan")),
        save.click(),
      ]);
      await expect(page.getByText("Identitas situs disimpan.")).toBeVisible();
      await expect(input).toHaveValue(announcement);
      await expect.poll(async () => (await pool.query("SELECT value->'site'->>'announcement' AS announcement FROM settings WHERE key='store.settings'")).rows[0].announcement).toBe(announcement);
      await shopper.reload({ waitUntil: "load" });
      await expect(shopper.getByText(announcement, { exact: true })).toBeVisible();

      await input.fill("");
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/admin/pengaturan")),
        save.click(),
      ]);
      await expect(input).toHaveValue("");
      await expect.poll(async () => (await pool.query("SELECT value->'site'->>'announcement' AS announcement FROM settings WHERE key='store.settings'")).rows[0].announcement).toBeNull();
      await shopper.reload({ waitUntil: "load" });
      await expect(shopper.getByText(announcement, { exact: true })).toHaveCount(0);
      await shopper.goto("/rank", { waitUntil: "load" });
      await expect(shopper.getByText(announcement, { exact: true })).toHaveCount(0);
      await page.reload({ waitUntil: "load" });
      await expect(input).toHaveValue("");

      const nextAnnouncement = `${announcement} lagi`;
      await input.fill(nextAnnouncement);
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/admin/pengaturan")),
        save.click(),
      ]);
      await expect(input).toHaveValue(nextAnnouncement);
      await shopper.reload({ waitUntil: "load" });
      await expect(shopper.getByText(nextAnnouncement, { exact: true })).toBeVisible();

      await input.fill("   ");
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/admin/pengaturan")),
        save.click(),
      ]);
      await expect.poll(async () => (await pool.query("SELECT value->'site'->>'announcement' AS announcement FROM settings WHERE key='store.settings'")).rows[0].announcement).toBeNull();
      await shopper.reload({ waitUntil: "load" });
      await expect(shopper.getByText(nextAnnouncement, { exact: true })).toHaveCount(0);
      expect((await pool.query("SELECT value #- '{site,announcement}' AS other FROM settings WHERE key='store.settings'")).rows[0].other).toEqual(originalOtherSettings);
    } finally {
      await shopper.close();
    }
  });
});
