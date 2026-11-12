import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  ORDER_STATUS_LABEL,
  DELIVERY_STATUS_LABEL,
  InvalidOrderTransitionError,
  assertTransition,
  canTransition,
  isDeliverable,
  isTerminal,
  type OrderStatus,
} from "@/lib/order-state";

describe("state machine order", () => {
  it("tidak pernah mengenal status REFUNDED", () => {
    expect(ORDER_STATUSES).not.toContain("REFUNDED");
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      expect(targets).not.toContain("REFUNDED");
    }
    expect(Object.values(ORDER_STATUS_LABEL).join(" ")).not.toMatch(/refund/i);
  });

  it("alur normal PENDING → PAID → DELIVERING → DELIVERED", () => {
    expect(canTransition("PENDING", "PAID")).toBe(true);
    expect(canTransition("PAID", "DELIVERING")).toBe(true);
    expect(canTransition("DELIVERING", "DELIVERED")).toBe(true);
  });

  it("mengizinkan pembayaran telat dari EXPIRED", () => {
    expect(canTransition("EXPIRED", "PAID")).toBe(true);
  });

  it("mengizinkan retry setelah FAILED", () => {
    expect(canTransition("FAILED", "DELIVERING")).toBe(true);
    expect(canTransition("FAILED", "DELIVERED")).toBe(true);
  });

  it("chargeback memindahkan order ke DISPUTED dari status yang sudah dibayar", () => {
    for (const from of ["PAID", "DELIVERING", "FAILED", "DELIVERED"] as OrderStatus[]) {
      expect(canTransition(from, "DISPUTED")).toBe(true);
    }
    expect(canTransition("DISPUTED", "DELIVERED")).toBe(true);
  });

  it("memblokir transisi mundur dan lompatan ilegal", () => {
    expect(canTransition("DELIVERED", "PENDING")).toBe(false);
    expect(canTransition("PAID", "PENDING")).toBe(false);
    expect(canTransition("CANCELLED", "PAID")).toBe(false);
    expect(canTransition("CANCELLED", "DELIVERED")).toBe(false);
    expect(canTransition("PENDING", "DELIVERED")).toBe(false);
    expect(canTransition("DISPUTED", "PAID")).toBe(false);
  });

  it("menolak transisi ke status yang sama", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("assertTransition melempar error yang informatif", () => {
    expect(() => assertTransition("PENDING", "PAID")).not.toThrow();
    try {
      assertTransition("CANCELLED", "PAID");
      throw new Error("seharusnya melempar");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidOrderTransitionError);
      expect((error as Error).message).toContain("CANCELLED");
    }
  });

  it("menandai status terminal dan status yang bisa dikirim", () => {
    expect(isTerminal("DELIVERED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("DISPUTED")).toBe(true);
    expect(isTerminal("PAID")).toBe(false);
    expect(isTerminal("FAILED")).toBe(false);

    expect(isDeliverable("PAID")).toBe(true);
    expect(isDeliverable("DELIVERING")).toBe(true);
    expect(isDeliverable("FAILED")).toBe(true);
    expect(isDeliverable("EXPIRED")).toBe(false);
    expect(isDeliverable("DELIVERED")).toBe(false);
    expect(isDeliverable("DISPUTED")).toBe(false);
  });

  it("setiap status punya label Indonesia dan label pengiriman lengkap", () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABEL[status].length).toBeGreaterThan(2);
    }
    expect(DELIVERY_STATUS_LABEL.QUEUED).toBe("Dalam antrean");
    expect(DELIVERY_STATUS_LABEL.DEAD).toBe("Gagal permanen");
  });
});
