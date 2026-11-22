import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { databaseUrl } from "./helpers";

// Temporary tables keep the migration test isolated from even other test fixtures.
describe.skipIf(!databaseUrl())("migrasi permission kit Essentials", () => {
  it("hanya memigrasikan pasangan bawaan tanpa riwayat; tidak mengubah antrean atau entitlement", async () => {
    const client = new Client({ connectionString: databaseUrl()! });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TEMP TABLE products (id text, slug text, type text, tagline text, description text, perks text[], updated_at timestamptz);
        CREATE TEMP TABLE command_templates (product_id text, kind text, template text, updated_at timestamptz);
        CREATE TEMP TABLE entitlements (product_id text, active boolean);
        CREATE TEMP TABLE deliveries (product_id text, status text, commands jsonb);
      `);
      const oldTagline = "Akses kit Diamond lewat PlayerKits selama satu season.";
      const oldDescription = "Pembelian mengaktifkan akses CipiPrime di PlayerKits sampai season berakhir. Klaim kit dapat diulang dengan cooldown 5 jam yang diatur di server.";
      const oldPerks = ["Akses PlayerKits sampai season berakhir", "Cooldown klaim 5 jam diatur oleh PlayerKits", "Dibeli sekali per pemain setiap season"];
      for (const [id, slug, target] of [
        ["clean-uuid", "cipiprime", "{uuid}"],
        ["clean-player", "cipi-plus-plus", "{player}"],
        ["historic-entitlement", "cipi-plus-plus", "{uuid}"],
        ["historic-delivery", "cipiprime", "{uuid}"],
        ["custom", "cipiprime", "{uuid}"],
        ["mixed", "cipiprime", "{uuid}"],
        ["duplicate", "cipiprime", "{uuid}"],
      ]) {
        const permission = slug === "cipiprime" ? "playerkits.kits.cipiprime" : "playerkits.kits.cipi++";
        await client.query("INSERT INTO products VALUES ($1,$2,'KIT',$3,$4,$5,now())", [id, slug, oldTagline, oldDescription, oldPerks]);
        await client.query("INSERT INTO command_templates VALUES ($1,'GRANT',$2,now()),($1,'REVOKE',$3,now())", [id,
          `lp user ${target} permission set ${permission} true`,
          id === "custom" ? "custom command" : `lp user ${id === "mixed" ? "{player}" : target} permission unset ${permission}`,
        ]);
      }
      // Test defensively even though the real schema has a unique (product_id, kind) index.
      await client.query("INSERT INTO command_templates VALUES ('duplicate','GRANT','custom command',now())");
      await client.query("INSERT INTO entitlements VALUES ('historic-entitlement',true)");
      await client.query("INSERT INTO deliveries VALUES ('historic-delivery','QUEUED',$1)", [JSON.stringify(["old command"])]);
      const migration = await readFile("src/server/db/migrations/0021_essentials_kit_permissions.sql", "utf8");
      await client.query(migration);
      await client.query(migration); // idempotent, including the copied default text
      const { rows } = await client.query("SELECT product_id,kind,template FROM command_templates ORDER BY product_id,kind");
      const template = (id: string, kind: string) => rows.find((r) => r.product_id === id && r.kind === kind)?.template;
      expect(template("clean-uuid", "GRANT")).toBe("lp user {uuid} permission set essentials.kits.cipiprime true");
      expect(template("clean-uuid", "REVOKE")).toBe("lp user {uuid} permission unset essentials.kits.cipiprime");
      expect(template("clean-player", "GRANT")).toBe("lp user {uuid} permission set essentials.kits.cipi++ true");
      expect(template("clean-player", "REVOKE")).toBe("lp user {uuid} permission unset essentials.kits.cipi++");
      for (const id of ["historic-entitlement", "historic-delivery", "custom", "mixed"]) {
        expect(template(id, "GRANT")).toContain("playerkits.kits.");
      }
      expect(template("custom", "REVOKE")).toBe("custom command");
      expect(rows.filter((r) => r.product_id === "duplicate").map((r) => r.template))
        .toContain("custom command");
      expect(rows.find((r) => r.product_id === "duplicate" && r.template.includes("playerkits.kits."))).toBeDefined();
      const deliveries = await client.query("SELECT * FROM deliveries");
      expect(deliveries.rows).toEqual([{ product_id: "historic-delivery", status: "QUEUED", commands: ["old command"] }]);
      expect((await client.query("SELECT * FROM entitlements")).rows).toEqual([{ product_id: "historic-entitlement", active: true }]);
      const copy = await client.query("SELECT tagline,description,perks FROM products WHERE id = 'clean-uuid'");
      expect(copy.rows[0].tagline).toContain("Essentials");
      expect(copy.rows[0].description).toContain("Essentials");
      expect(copy.rows[0].perks[0]).toContain("Essentials");
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
});
