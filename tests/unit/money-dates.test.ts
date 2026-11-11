import { describe, expect, it } from "vitest";
import { clampNonNegative, computeTotal, formatIDR, formatRp, parseIdr, percentOf } from "@/lib/money";
import { addDays, daysUntil, formatDateWIB, formatDateTimeWIB, jakartaDateKey, minutesAgo, startOfWibDay } from "@/lib/dates";
import { maskEmail, normalizeEmail, randomToken } from "@/lib/tokens";
import { safeNext } from "@/lib/safe-redirect";

describe("uang (IDR integer)", () => {
  it("memformat rupiah tanpa desimal", () => {
    expect(formatRp(25_000)).toBe("Rp 25.000");
    expect(formatIDR(1_500_000).replace(/\s/g, " ")).toBe("Rp 1.500.000");
    expect(formatRp(0)).toBe("Rp 0");
  });

  it("membulatkan persen ke integer terdekat", () => {
    expect(percentOf(90_000, 11)).toBe(9_900);
    expect(percentOf(33_333, 10)).toBe(3_333);
    expect(percentOf(100, 0)).toBe(0);
    expect(Number.isInteger(percentOf(12_345, 7.5))).toBe(true);
  });

  it("tidak pernah menghasilkan nilai negatif", () => {
    expect(clampNonNegative(-1)).toBe(0);
    expect(computeTotal(100_000, 150_000, 0, 0)).toBe(0);
  });

  it("menjumlahkan total secara konsisten", () => {
    expect(computeTotal(100_000, 10_000, 9_900, 6_000)).toBe(105_900);
  });

  it("mem-parse input harga pengguna", () => {
    expect(parseIdr("25.000")).toBe(25_000);
    expect(parseIdr("Rp 25.000")).toBe(25_000);
    expect(parseIdr("abc")).toBeNull();
    expect(parseIdr("-500")).toBeNull();
  });
});

describe("tanggal Asia/Jakarta", () => {
  it("memformat tanggal dalam WIB, bukan UTC", () => {
    // 2025-03-31T18:30Z = 1 April 2025 01:30 WIB
    const date = new Date("2025-03-31T18:30:00.000Z");
    expect(jakartaDateKey(date)).toBe("2025-04-01");
    expect(formatDateWIB(date)).toContain("2025");
    expect(formatDateTimeWIB(date)).toContain("01.30");
  });

  it("menghitung awal hari kalender WIB termasuk pergantian UTC", () => {
    expect(startOfWibDay(new Date("2025-03-31T18:30:00.000Z")).toISOString()).toBe("2025-03-31T17:00:00.000Z");
    expect(startOfWibDay(new Date("2025-03-31T16:59:59.000Z")).toISOString()).toBe("2025-03-30T17:00:00.000Z");
  });

  it("menghitung selisih hari", () => {
    const now = new Date("2025-03-01T00:00:00.000Z");
    expect(daysUntil(addDays(now, 7), now)).toBe(7);
    expect(minutesAgo(new Date(now.getTime() - 5 * 60_000), now)).toBe(5);
  });
});

describe("token dan email", () => {
  it("membuat token acak yang berbeda dan cukup panjang", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("menormalkan dan menyamarkan email", () => {
    expect(normalizeEmail("  Cipi@Example.COM ")).toBe("cipi@example.com");
    expect(maskEmail("cipiplayer@example.com")).toMatch(/^ci.*@example\.com$/);
    expect(maskEmail("cipiplayer@example.com")).not.toContain("player");
  });
});

describe("safeNext (anti open redirect)", () => {
  it("mengizinkan path internal", () => {
    expect(safeNext("/dashboard/pesanan")).toBe("/dashboard/pesanan");
    expect(safeNext("/checkout")).toBe("/checkout");
  });

  it("menolak tujuan eksternal dan kosong", () => {
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext("javascript:alert(1)")).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext(undefined)).toBe("/dashboard");
  });
});
