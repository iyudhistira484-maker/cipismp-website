import { describe, expect, it } from "vitest";
import { parseWibDate } from "@/lib/admin-export-date";
import { toCsv } from "@/server/admin/export";

describe("filter tanggal ekspor", () => {
  it("menganggap tanggal kosong sebagai tanpa filter", () => {
    expect(parseWibDate(null)).toEqual({ valid: true });
    expect(parseWibDate("")).toEqual({ valid: true });
  });

  it("mem-parse batas hari WIB dan menyertakan seluruh hari akhir", () => {
    const from = parseWibDate("2026-11-11");
    const to = parseWibDate("2026-11-11", true);
    expect(from.valid && from.date?.toISOString()).toBe("2026-11-10T17:00:00.000Z");
    expect(to.valid && to.date?.toISOString()).toBe("2026-11-11T16:59:59.999Z");
  });

  it("menolak format dan tanggal kalender yang tidak valid", () => {
    expect(parseWibDate("11-11-2026")).toEqual({ valid: false });
    expect(parseWibDate("2026-02-29")).toEqual({ valid: false });
    expect(parseWibDate("2026-13-01", true)).toEqual({ valid: false });
  });
});

describe("ekspor CSV", () => {
  it("menulis header + baris dengan CRLF dan BOM", () => {
    const csv = toCsv(["order", "total"], [["CIPI-1", 25000]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("order,total\r\n");
    expect(csv).toContain("CIPI-1,25000\r\n");
  });

  it("meng-escape koma, kutip, dan baris baru (RFC 4180)", () => {
    const csv = toCsv(["catatan"], [['Transfer "BCA", 25.000\nverified']]);
    expect(csv).toContain('"Transfer ""BCA"", 25.000\nverified"');
  });

  it("mengosongkan nilai null tanpa memecah kolom", () => {
    const csv = toCsv(["a", "b", "c"], [[null, "x", null]]);
    expect(csv.split("\r\n")[1]).toBe(",x,");
  });

  it("menetralkan sel yang bisa dieksekusi sebagai formula spreadsheet", () => {
    const cell = toCsv(["v"], [["=HYPERLINK(\"http://jahat\")"]]).split("\r\n")[1] ?? "";
    expect(cell).toContain("'=HYPERLINK");
    expect(toCsv(["v"], [["+62 812"]]).split("\r\n")[1]).toBe("'+62 812");
    expect(toCsv(["v"], [["-5"]]).split("\r\n")[1]).toBe("'-5");
    // Angka asli tetap ditulis sebagai angka, bukan teks.
    expect(toCsv(["v"], [[-5]]).split("\r\n")[1]).toBe("-5");
  });
});
