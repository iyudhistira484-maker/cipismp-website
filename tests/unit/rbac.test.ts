import { describe, expect, it } from "vitest";
import { ForbiddenError, assertPermission, hasPermission } from "@/server/rbac";

describe("matriks izin admin", () => {
  it("membatasi Support ke operasi, order, pelanggan, comp, dan audit", () => {
    expect(hasPermission("SUPPORT", "orders.read")).toBe(true);
    expect(hasPermission("SUPPORT", "delivery.read")).toBe(true);
    expect(hasPermission("SUPPORT", "orders.redeliver")).toBe(true);
    expect(hasPermission("SUPPORT", "grants.write")).toBe(true);
    expect(hasPermission("SUPPORT", "customers.read")).toBe(true);
    expect(hasPermission("SUPPORT", "audit.read")).toBe(true);
    expect(hasPermission("SUPPORT", "analytics.read")).toBe(false);
    expect(hasPermission("SUPPORT", "products.write")).toBe(false);
    expect(hasPermission("SUPPORT", "settings.read")).toBe(false);
  });

  it("mengizinkan Admin mengelola toko tanpa akses kesiapan/provider dan kontrol Owner", () => {
    expect(hasPermission("ADMIN", "analytics.read")).toBe(true);
    expect(hasPermission("ADMIN", "products.write")).toBe(true);
    expect(hasPermission("ADMIN", "settings.read")).toBe(true);
    expect(hasPermission("ADMIN", "settings.write")).toBe(true);
    expect(hasPermission("ADMIN", "payments.secrets")).toBe(false);
    expect(hasPermission("ADMIN", "staff.write")).toBe(false);
    expect(hasPermission("OWNER", "payments.secrets")).toBe(true);
  });

  it("menegakkan perbedaan izin dengan ForbiddenError", () => {
    expect(() => assertPermission("SUPPORT", "analytics.read")).toThrow(ForbiddenError);
    expect(() => assertPermission("ADMIN", "payments.secrets")).toThrow(ForbiddenError);
    expect(() => assertPermission("OWNER", "payments.secrets")).not.toThrow();
  });
});
