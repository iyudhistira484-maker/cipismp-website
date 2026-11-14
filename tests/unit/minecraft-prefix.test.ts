import { describe, expect, it } from "vitest";
import { normalizeUsername } from "@/server/minecraft";

describe("prefiks Floodgate", () => {
  it("membedakan Bedrock dan Java yang sama-sama diawali garis bawah", () => {
    expect(normalizeUsername("_CipiPlayer", "BEDROCK")).toEqual({ name: "_CipiPlayer", edition: "BEDROCK" });
    expect(normalizeUsername("_CipiPlayer", "JAVA")).toEqual({ name: "_CipiPlayer", edition: "JAVA" });
    expect(() => normalizeUsername("_CipiPlayer")).toThrow(/Pilih edisi/);
    expect(normalizeUsername("CipiPlayer")).toEqual({ name: "CipiPlayer", edition: "JAVA" });
  });
  it("menolak prefix lama dan nama Bedrock tanpa prefix baru", () => {
    for (const name of [".CipiPlayer", "CipiPlayer", "_ab", "_Cipi!"]) {
      expect(() => normalizeUsername(name, "BEDROCK")).toThrow();
    }
    expect(() => normalizeUsername(".CipiPlayer")).toThrow();
    expect(normalizeUsername("_Player Name", "BEDROCK").name).toBe("_Player Name");
  });
});
