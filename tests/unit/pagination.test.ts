import { describe, expect, it } from "vitest";
import { cursorPage, decodeCursor, encodeCursor, PAGE_SIZE } from "@/server/pagination";

describe("cursor riwayat", () => {
  it("mempertahankan mikrodetik dan menolak input tidak valid", () => {
    const cursor = { at: "2026-01-02T03:04:05.123456Z", id: "ord_123", direction: "older" as const };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    for (const invalid of ["!", "x".repeat(513), Buffer.from(JSON.stringify({ ...cursor, at: "2026-02-31T00:00:00.000001Z" })).toString("base64url"), Buffer.from(JSON.stringify({ ...cursor, id: "' OR true" })).toString("base64url")]) {
      expect(decodeCursor(invalid)).toBeNull();
    }
  });
  it("membalik urutan hasil halaman lebih baru dan membuat tautan yang tepat", () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({ id: `x${i}`, cursorAt: "2026-01-01T00:00:00.000001Z" }));
    const newer = cursorPage(rows, { at: rows[0]!.cursorAt, id: "anchor", direction: "newer" });
    expect(newer.items[0]?.id).toBe("x19");
    expect(newer.items.at(-1)?.id).toBe("x0");
    expect(decodeCursor(newer.previous!)?.direction).toBe("newer");
    expect(decodeCursor(newer.next!)?.direction).toBe("older");
  });
});
