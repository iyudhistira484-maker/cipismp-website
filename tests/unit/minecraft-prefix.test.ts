import { describe, expect, it } from "vitest";
import { deterministicUuid, normalizeUsername } from "@/server/minecraft";

describe("prefiks Floodgate", () => {
  it("menerima titik hanya untuk Bedrock dan tetap mendukung Java berawalan garis bawah", () => {
    expect(normalizeUsername(".CipiPlayer", "BEDROCK")).toEqual({ name: ".CipiPlayer", edition: "BEDROCK" });
    expect(normalizeUsername("_CipiPlayer", "JAVA")).toEqual({ name: "_CipiPlayer", edition: "JAVA" });
    expect(normalizeUsername("CipiPlayer")).toEqual({ name: "CipiPlayer", edition: "JAVA" });
    for (const name of [".CipiPlayer", "_CipiPlayer"]) expect(() => normalizeUsername(name)).toThrow(/Pilih edisi/);
    expect(() => normalizeUsername(".CipiPlayer", "JAVA")).toThrow();
    expect(() => normalizeUsername("_CipiPlayer", "BEDROCK")).toThrow();
  });

  it("memvalidasi panjang, karakter dan spasi setelah titik", () => {
    for (const name of ["CipiPlayer", ".ab", ".", ".Cipi!", "..Cipi", `.${"a".repeat(17)}`]) {
      expect(() => normalizeUsername(name, "BEDROCK")).toThrow();
    }
    expect(normalizeUsername(".abc", "BEDROCK").name).toBe(".abc");
    expect(normalizeUsername(`.${"a".repeat(16)}`, "BEDROCK").name).toBe(`.${"a".repeat(16)}`);
    expect(normalizeUsername(".Player Name", "BEDROCK").name).toBe(".Player Name");
  });

  it("tidak menyamakan UUID placeholder untuk nama lama dan baru", () => {
    expect(deterministicUuid("_CipiPlayer", "BEDROCK")).not.toBe(deterministicUuid(".CipiPlayer", "BEDROCK"));
  });
});
