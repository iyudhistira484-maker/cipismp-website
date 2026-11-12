import { describe, expect, it } from "vitest";
import { orderTimeline } from "@/lib/order-timeline";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-state";

const paidAt = new Date("2026-11-12T10:00:00Z");
const deliveredAt = new Date("2026-11-12T10:05:00Z");
const states = (status: OrderStatus, options: { paymentStatus?: string; paidAt?: Date; deliveredAt?: Date } = {}) => orderTimeline({ status, ...options }).map((step) => step.state);

describe("timeline pesanan", () => {
  it.each([
    ["PENDING", ["current", "upcoming", "upcoming", "upcoming"]],
    ["PAID", ["complete", "current", "upcoming", "upcoming"]],
    ["DELIVERING", ["complete", "complete", "current", "upcoming"]],
    ["DELIVERED", ["complete", "complete", "complete", "current"]],
    ["EXPIRED", ["attention", "upcoming", "upcoming", "upcoming"]],
    ["CANCELLED", ["attention", "upcoming", "upcoming", "upcoming"]],
    ["FAILED", ["complete", "complete", "attention", "upcoming"]],
    ["DISPUTED", ["complete", "attention", "upcoming", "upcoming"]],
  ] as const)("memetakan status %s tanpa mengarang tahap selesai", (status, expected) => {
    expect(states(status, { paidAt })).toEqual(expected);
  });
  it("memisahkan pembayaran kurang dari pembayaran biasa", () => {
    const result = orderTimeline({ status: "PENDING", paymentStatus: "UNDERPAID" });
    expect(result[0]?.state).toBe("attention");
    expect(result[0]?.hint).toContain("Nominal kurang");
    expect(result[1]?.state).toBe("upcoming");
  });
  it("sengketa dan kegagalan tanpa catatan pembayaran tidak mengaku sudah dibayar", () => {
    expect(states("FAILED")).toEqual(["upcoming", "upcoming", "attention", "upcoming"]);
    expect(states("DISPUTED")).toEqual(["upcoming", "attention", "upcoming", "upcoming"]);
  });
  it("sengketa setelah selesai tetap ditinjau dan hanya menampilkan tanggal yang ada", () => {
    const result = orderTimeline({ status: "DISPUTED", paidAt, deliveredAt });
    expect(result[3]?.state).toBe("upcoming");
    expect(result[3]?.hint).toContain("kini ditinjau");
    expect(result[3]?.date).toEqual(deliveredAt);
    expect(orderTimeline({ status: "DELIVERED" })[3]?.date).toBeFalsy();
  });
  it("semua status memiliki satu tahap saat ini atau memerlukan perhatian", () => {
    for (const status of ORDER_STATUSES) expect(states(status).filter((s) => s === "current" || s === "attention")).toHaveLength(1);
  });
});
