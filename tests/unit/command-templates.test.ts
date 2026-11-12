import { describe, expect, it } from "vitest";
import { renderTemplate, validateTemplate } from "@/server/delivery/commands";

describe("template perintah produk", () => {
  it("mengganti placeholder yang didukung dan mengabaikan baris komentar", () => {
    const template = "# catatan\nlp user {player} parent add {rank}\npermission set {uuid} {season}";
    expect(validateTemplate(template)).toEqual({ ok: true });
    expect(renderTemplate(template, {
      player: "CipiPlayer",
      uuid: "uuid-1",
      season: "season-2",
      rank: "star-cipi",
    })).toEqual([
      "lp user CipiPlayer parent add star-cipi",
      "permission set uuid-1 season-2",
    ]);
  });

  it("menolak placeholder yang tidak dikenal agar command mudah diperiksa admin", () => {
    expect(validateTemplate("lp user {player} parent add {unknown}")).toEqual({
      ok: false,
      error: "Placeholder tidak dikenal: {unknown}",
    });
  });

  it("menerima template revoke komentar tanpa menjalankan baris", () => {
    expect(renderTemplate("# dicabut otomatis saat season berakhir", {
      player: "CipiPlayer",
      uuid: "uuid-1",
      season: "season-2",
    })).toEqual([]);
  });
});
