import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@/lib/order-state";
import { deliveryTrackingMessage, orderTrackingMessage } from "@/lib/order-tracking";

describe("status pesanan untuk pelanggan", () => {
  it("memberikan penjelasan untuk seluruh status tanpa membocorkan error internal", () => {
    for (const status of ORDER_STATUSES) expect(orderTrackingMessage(status).body.length).toBeGreaterThan(20);
    expect(orderTrackingMessage("PENDING", "UNDERPAID")).toMatchObject({ needsHelp: true, title: "Pembayaran perlu diperiksa" });
    expect(orderTrackingMessage("EXPIRED").body).toMatch(/sudah membayar/i);
    expect(orderTrackingMessage("FAILED").needsHelp).toBe(true);
    expect(deliveryTrackingMessage("DEAD")).toMatch(/bantuan/i);
    expect(deliveryTrackingMessage("sensitive raw error")).toBe("Status pengiriman belum tersedia.");
  });
});
