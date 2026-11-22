import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { databaseUrl } from "./helpers";

// Temporary tables are isolated from real test fixtures; use a disposable database.
describe.skipIf(!databaseUrl())("migrasi permission kit PlayerKits2", () => {
  it("migrasi pasangan tepat tanpa riwayat dan menahan riwayat, campuran, kustom dan duplikat", async () => {
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
      const cases = [
        ["ess-prime", "cipiprime", "essentials", "{uuid}"],
        ["old-plus", "cipi-plus-plus", "legacy", "{player}"],
        ["hist-ent", "cipi-plus-plus", "essentials", "{uuid}"],
        ["hist-del", "cipiprime", "legacy", "{uuid}"],
        ["custom", "cipiprime", "essentials", "{uuid}"],
        ["mixed-target", "cipiprime", "legacy", "{uuid}"],
        ["mixed-permission", "cipiprime", "essentials", "{uuid}"],
        ["duplicate", "cipiprime", "legacy", "{uuid}"],
        ["other-type", "cipiprime", "essentials", "{uuid}"],
      ] as const;
      for (const [id, slug, source, target] of cases) {
        const name = slug === "cipiprime" ? "cipiprime" : "cipi++";
        const perm = `${source === "essentials" ? "essentials.kits" : "playerkits.kits"}.${name}`;
        const revokePerm = id === "mixed-permission" ? `playerkits.kits.${name}` : perm;
        const revokeTarget = id === "mixed-target" ? "{player}" : target;
        await client.query("INSERT INTO products VALUES ($1,$2,$3,$4,$5,$6,now())", [id, slug, id === "other-type" ? "RANK" : "KIT",
          "Akses kit Diamond lewat Essentials selama satu season.",
          "Pembelian mengaktifkan akses CipiPrime di Essentials sampai season berakhir. Klaim kit dapat diulang dengan cooldown yang diatur di server.",
          ["Akses kit Essentials sampai season berakhir", "Cooldown klaim diatur oleh server", "Dibeli sekali per pemain setiap season"],
        ]);
        await client.query("INSERT INTO command_templates VALUES ($1,'GRANT',$2,now()),($1,'REVOKE',$3,now())", [id,
          `lp user ${target} permission set ${perm} true`, id === "custom" ? "custom" : `lp user ${revokeTarget} permission unset ${revokePerm}`,
        ]);
      }
      await client.query("INSERT INTO command_templates VALUES ('duplicate','GRANT','custom',now())");
      await client.query("UPDATE products SET tagline='Teks khusus Owner' WHERE id='custom'");
      await client.query("INSERT INTO entitlements VALUES ('hist-ent',false)");
      await client.query("INSERT INTO deliveries VALUES ('hist-del','QUEUED',$1)", [JSON.stringify(["old command"])]);
      const before = (await client.query("SELECT product_id,kind,template FROM command_templates ORDER BY product_id,kind,template")).rows;
      const migration = await readFile("src/server/db/migrations/0022_playerkits2_permissions.sql", "utf8");
      await client.query(migration);
      await client.query(migration);
      const after = (await client.query("SELECT product_id,kind,template FROM command_templates ORDER BY product_id,kind,template")).rows;
      const template = (id: string, kind: string) => after.find((r) => r.product_id === id && r.kind === kind)?.template;
      for (const [id, name] of [["ess-prime", "cipiprime"], ["old-plus", "cipi++"]]) {
        expect(template(id!, "GRANT")).toBe(`lp user {uuid} permission set playerkits.kit.${name} true`);
        expect(template(id!, "REVOKE")).toBe(`lp user {uuid} permission unset playerkits.kit.${name}`);
      }
      for (const id of ["hist-ent", "hist-del", "custom", "mixed-target", "mixed-permission", "duplicate", "other-type"]) {
        expect(after.filter((r) => r.product_id === id)).toEqual(before.filter((r) => r.product_id === id));
      }
      expect((await client.query("SELECT * FROM deliveries")).rows).toEqual([{ product_id: "hist-del", status: "QUEUED", commands: ["old command"] }]);
      expect((await client.query("SELECT * FROM entitlements")).rows).toEqual([{ product_id: "hist-ent", active: false }]);
      const copy = (await client.query("SELECT tagline,description,perks FROM products WHERE id='ess-prime'")).rows[0];
      expect(copy.tagline).toContain("PlayerKits2");
      expect(copy.description).toContain("PlayerKits2");
      expect(copy.perks[0]).toContain("PlayerKits2");
      expect((await client.query("SELECT tagline FROM products WHERE id='other-type'")).rows[0].tagline).toContain("Essentials");
      expect((await client.query("SELECT tagline FROM products WHERE id='custom'")).rows[0].tagline).toBe("Teks khusus Owner");

      // On an old installation, 0021 runs before 0022; verify that full chain too.
      await client.query(`
        INSERT INTO products VALUES ('chain','cipiprime','KIT',
          'Akses kit Diamond lewat PlayerKits selama satu season.',
          'Pembelian mengaktifkan akses CipiPrime di PlayerKits sampai season berakhir. Klaim kit dapat diulang dengan cooldown 5 jam yang diatur di server.',
          ARRAY['Akses PlayerKits sampai season berakhir','Cooldown klaim 5 jam diatur oleh PlayerKits','Dibeli sekali per pemain setiap season'],now());
        INSERT INTO command_templates VALUES
          ('chain','GRANT','lp user {uuid} permission set playerkits.kits.cipiprime true',now()),
          ('chain','REVOKE','lp user {uuid} permission unset playerkits.kits.cipiprime',now());
      `);
      await client.query(await readFile("src/server/db/migrations/0021_essentials_kit_permissions.sql", "utf8"));
      await client.query(migration);
      const chain = (await client.query("SELECT kind,template FROM command_templates WHERE product_id='chain' ORDER BY kind")).rows;
      expect(chain).toEqual([
        { kind: "GRANT", template: "lp user {uuid} permission set playerkits.kit.cipiprime true" },
        { kind: "REVOKE", template: "lp user {uuid} permission unset playerkits.kit.cipiprime" },
      ]);
      expect((await client.query("SELECT tagline FROM products WHERE id='chain'")).rows[0].tagline).toContain("PlayerKits2");
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
});
