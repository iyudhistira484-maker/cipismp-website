import { describe, expect, it } from "vitest";
import { toCsv } from "@/server/admin/export";

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
