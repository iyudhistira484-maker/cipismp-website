import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { commandTemplates, products } from "../db/schema";

export interface CommandContext {
  player: string;
  uuid: string;
  season: string;
  rank?: string;
  kitname?: string;
}

/** Ganti placeholder pada template perintah. Baris berawalan # adalah komentar. */
export function renderTemplate(template: string, context: CommandContext): string[] {
  return template
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) =>
      line
        .replaceAll("{player}", context.player)
        .replaceAll("{uuid}", context.uuid)
        .replaceAll("{season}", context.season)
        .replaceAll("{rank}", context.rank ?? "")
        .replaceAll("{kitname}", context.kitname ?? ""),
    );
}

export function validateTemplate(template: string): { ok: boolean; error?: string } {
  const allowed = ["{player}", "{uuid}", "{season}", "{rank}", "{kitname}"];
  const unknown = template.match(/\{[a-zA-Z_]+\}/g)?.filter((token) => !allowed.includes(token)) ?? [];
  if (unknown.length > 0) return { ok: false, error: `Placeholder tidak dikenal: ${unknown.join(", ")}` };
  return { ok: true };
}

async function templatesFor(productId: string) {
  return db.select().from(commandTemplates).where(eq(commandTemplates.productId, productId));
}

/**
 * Perintah GRANT untuk sebuah produk, dengan info tier/season terisi otomatis.
 */
export async function buildGrantCommands(input: {
  productId: string;
  player: string;
  uuid: string;
  seasonSlug: string;
}): Promise<string[]> {
  const rows = await templatesFor(input.productId);
  const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
  const grant = rows.find((row) => row.kind === "GRANT");
  if (!grant) return [];
  return renderTemplate(grant.template, {
    player: input.player,
    uuid: input.uuid,
    season: input.seasonSlug,
    rank: product[0]?.slug ?? "",
    kitname: product[0]?.slug ?? "",
  });
}

export async function buildRevokeCommands(input: {
  productId: string;
  player: string;
  uuid: string;
  seasonSlug: string;
}): Promise<string[]> {
  const rows = await templatesFor(input.productId);
  const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
  const revoke = rows.find((row) => row.kind === "REVOKE");
  if (!revoke) return [];
  return renderTemplate(revoke.template, {
    player: input.player,
    uuid: input.uuid,
    season: input.seasonSlug,
    rank: product[0]?.slug ?? "",
    kitname: product[0]?.slug ?? "",
  });
}

export async function buildCommandsForProduct(
  productId: string,
  kind: "GRANT" | "REVOKE",
  context: CommandContext,
): Promise<Array<{ id: string; kind: "GRANT" | "REVOKE"; template: string; commands: string[] }>> {
  const rows = await db
    .select()
    .from(commandTemplates)
    .where(and(eq(commandTemplates.productId, productId), eq(commandTemplates.kind, kind)));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    template: row.template,
    commands: renderTemplate(row.template, context),
  }));
}
