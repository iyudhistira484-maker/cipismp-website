import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TripayAdapter } from "@/server/payments/tripay";
import { MidtransAdapter, mapMidtransStatus } from "@/server/payments/midtrans";

/**
 * Kontrak adapter gateway: bentuk payload dan algoritma signature mengikuti
 * dokumentasi resmi Tripay (X-Callback-Signature = HMAC-SHA256 raw body dengan
 * private key) dan Midtrans (signature_key = SHA512(order_id + status_code +
 * gross_amount + serverKey)). Test ini memakai payload contoh dari dokumentasi
 * sehingga tidak memerlukan kredensial atau koneksi ke gateway.
 */

const TRIPAY = new TripayAdapter(
  { apiKey: "DEV-api-key", privateKey: "DEV-private-key", merchantCode: "T0001" },
  "sandbox",
);

const MIDTRANS = new MidtransAdapter({ serverKey: "SB-Mid-server-TESTKEY", clientKey: "SB-Mid-client-TESTKEY" }, "sandbox");

function tripayCallback(overrides: Record<string, unknown> = {}) {
  return {
    reference: "T0001-REF-0001",
    merchant_ref: "CIPS-ABCD1234",
    payment_method: "BRIVA",
    payment_name: "BRIVA",
    customer_name: "Steve",
    customer_email: "steve@example.com",
    amount: 25000,
    fee_merchant: 750,
    fee_customer: 0,
    total_fee: 750,
    amount_received: 25000,
    is_closed_payment: 1,
    status: "PAID",
    paid_at: 1762900000,
    note: null,
    ...overrides,
  };
}

function tripayHeaders(rawBody: string, privateKey = "DEV-private-key") {
  return {
    "x-callback-event": "payment_status",
    "x-callback-signature": createHmac("sha256", privateKey).update(rawBody).digest("hex"),
  };
}

function midtransNotification(overrides: Record<string, unknown> = {}) {
  const base = {
    transaction_id: "7b0f2a8e-tripay-like",
    order_id: "CIPS-ABCD1234",
    merchant_id: "G123456789",
    gross_amount: "25000.00",
    currency: "IDR",
    payment_type: "qris",
    status_code: "200",
    transaction_status: "settlement",
    fraud_status: "accept",
    transaction_time: "2026-11-11 09:15:00",
    ...overrides,
  };
  const signature = createHash("sha512")
    .update(`${base.order_id}${base.status_code}${base.gross_amount}SB-Mid-server-TESTKEY`)
    .digest("hex");
  return { ...base, signature_key: signature };
}

const PAYMENT_INPUT = {
  orderNumber: "CIPS-ABCD1234",
  totalIdr: 25_000,
  customerName: "Steve Player",
  customerEmail: "steve@example.com",
  description: "Rank Iron",
  items: [{ name: "Rank Iron", priceIdr: 25_000, quantity: 1 }],
  method: "QRIS",
  returnUrl: "https://store.example.test/pesanan/CIPS-ABCD1234",
  expiresInMinutes: 60,
};

afterEach(() => vi.unstubAllGlobals());

describe("Tripay: verifikasi callback", () => {
  it("menerima signature HMAC-SHA256 yang benar dan memetakan PAID", async () => {
    const body = JSON.stringify(tripayCallback());
    const result = await TRIPAY.verifyWebhook(body, tripayHeaders(body));

    expect(result.signatureValid).toBe(true);
    expect(result.status).toBe("PAID");
    expect(result.amountIdr).toBe(25_000);
    expect(result.orderNumber).toBe("CIPS-ABCD1234");
    expect(result.providerRef).toBe("T0001-REF-0001");
    expect(result.method).toBe("BRIVA");
    expect(result.dedupeKey).toBe("TRIPAY:T0001-REF-0001:PAID:1762900000");
  });

  it("menolak body yang diubah setelah ditandatangani", async () => {
    const body = JSON.stringify(tripayCallback());
    const headers = tripayHeaders(body);
    const tampered = JSON.stringify(tripayCallback({ amount: 1_000 }));
    const result = await TRIPAY.verifyWebhook(tampered, headers);

    expect(result.signatureValid).toBe(false);
  });

  it("menolak signature dengan private key berbeda dan signature kosong", async () => {
    const body = JSON.stringify(tripayCallback());
    const wrong = await TRIPAY.verifyWebhook(body, tripayHeaders(body, "kunci-lain"));
    expect(wrong.signatureValid).toBe(false);

    const empty = await TRIPAY.verifyWebhook(body, {});
    expect(empty.signatureValid).toBe(false);
  });

  it("membedakan dedupe key untuk pembayaran ulang di waktu berbeda", async () => {
    const first = await TRIPAY.verifyWebhook(
      JSON.stringify(tripayCallback({ paid_at: 1762900000 })),
      tripayHeaders(JSON.stringify(tripayCallback({ paid_at: 1762900000 }))),
    );
    const second = await TRIPAY.verifyWebhook(
      JSON.stringify(tripayCallback({ paid_at: 1762909999 })),
      tripayHeaders(JSON.stringify(tripayCallback({ paid_at: 1762909999 }))),
    );
    expect(first.dedupeKey).not.toBe(second.dedupeKey);
  });

  it("memetakan status Tripay lain ke status internal", async () => {
    const cases = [
      ["UNPAID", "PENDING"],
      ["EXPIRED", "EXPIRED"],
      ["FAILED", "FAILED"],
      ["REFUND", "DISPUTED"],
      ["unknown", "FAILED"],
    ] as const;

    for (const [status, expected] of cases) {
      const payload = tripayCallback({ status });
      const body = JSON.stringify(payload);
      const result = await TRIPAY.verifyWebhook(body, tripayHeaders(body));
      expect(result.status).toBe(expected);
    }
  });
});

describe("Midtrans: verifikasi notifikasi", () => {
  it("menerima signature SHA512 yang benar dan memetakan settlement ke PAID", async () => {
    const notification = midtransNotification();
    const result = await MIDTRANS.verifyWebhook(JSON.stringify(notification), {});

    expect(result.signatureValid).toBe(true);
    expect(result.status).toBe("PAID");
    expect(result.amountIdr).toBe(25_000);
    expect(result.orderNumber).toBe("CIPS-ABCD1234");
    expect(result.providerRef).toBe("7b0f2a8e-tripay-like");
    expect(result.method).toBe("qris");
  });

  it("menolak signature yang dihitung dengan server key berbeda", async () => {
    const notification = midtransNotification();
    notification.order_id = "CIPS-LAIN";
    const result = await MIDTRANS.verifyWebhook(JSON.stringify(notification), {});
    expect(result.signatureValid).toBe(false);
  });

  it("menolak notifikasi tanpa signature_key", async () => {
    const { signature_key, ...rest } = midtransNotification();
    expect(signature_key).toBeTruthy();
    const result = await MIDTRANS.verifyWebhook(JSON.stringify(rest), {});
    expect(result.signatureValid).toBe(false);
  });

  it("memetakan kombinasi status + fraud status Midtrans", () => {
    expect(mapMidtransStatus("settlement", "")).toBe("PAID");
    expect(mapMidtransStatus("capture", "accept")).toBe("PAID");
    expect(mapMidtransStatus("capture", "challenge")).toBe("PENDING");
    expect(mapMidtransStatus("pending", "")).toBe("PENDING");
    expect(mapMidtransStatus("expire", "")).toBe("EXPIRED");
    expect(mapMidtransStatus("deny", "")).toBe("FAILED");
    expect(mapMidtransStatus("chargeback", "")).toBe("DISPUTED");
  });

  it("membedakan dedupe key untuk transaksi berbeda", async () => {
    const a = await MIDTRANS.verifyWebhook(JSON.stringify(midtransNotification()), {});
    const b = await MIDTRANS.verifyWebhook(
      JSON.stringify({ ...midtransNotification({ transaction_id: "lain" }), signature_key: "x" }),
      {},
    );
    expect(a.dedupeKey).not.toBe(b.dedupeKey);
  });
});

describe("request API sandbox", () => {
  it("membuat transaksi Tripay dengan endpoint, callback, dan signature request", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            reference: "TRX-REF-1",
            checkout_url: "https://tripay.test/checkout/TRX-REF-1",
            pay_code: "0123456789",
            pay_name: "QRIS",
            expired_time: 1_800_000_000,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await TRIPAY.createPayment(PAYMENT_INPUT);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://tripay.co.id/api-sandbox/transaction/create");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer DEV-api-key" });
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({
      method: "QRIS",
      merchant_ref: "CIPS-ABCD1234",
      amount: 25_000,
      customer_name: "Steve Player",
      customer_email: "steve@example.com",
      callback_url: "http://localhost:3000/api/webhooks/tripay",
      return_url: PAYMENT_INPUT.returnUrl,
    });
    expect(payload.signature).toBe(
      createHmac("sha256", "DEV-private-key").update("T0001CIPS-ABCD123425000").digest("hex"),
    );
    expect(result).toMatchObject({
      providerRef: "TRX-REF-1",
      checkoutUrl: "https://tripay.test/checkout/TRX-REF-1",
      payCode: "0123456789",
      method: "QRIS",
    });
  });

  it("membuat transaksi Midtrans dengan Snap sandbox, item, customer, dan Basic auth", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ token: "snap-token", redirect_url: "https://app.sandbox.midtrans.com/snap/v4/abc" }), {
        status: 201,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await MIDTRANS.createPayment(PAYMENT_INPUT);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://app.sandbox.midtrans.com/snap/v1/transactions");
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("SB-Mid-server-TESTKEY:").toString("base64")}`,
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      transaction_details: { order_id: "CIPS-ABCD1234", gross_amount: 25_000 },
      item_details: [{ id: "Rank Iron", price: 25_000, quantity: 1, name: "Rank Iron" }],
      customer_details: { first_name: "Steve Player", email: "steve@example.com" },
      callbacks: { finish: PAYMENT_INPUT.returnUrl, error: PAYMENT_INPUT.returnUrl },
      enabled_payments: ["QRIS"],
    });
    expect(result).toMatchObject({
      providerRef: "snap-token",
      checkoutUrl: "https://app.sandbox.midtrans.com/snap/v4/abc",
      method: "QRIS",
    });
  });
});
