import { createHmac } from "node:crypto";
import {
  PaymentProviderError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentAdapter,
  type StatusCheckResult,
  type WebhookResult,
} from "./types";
import { logger } from "../logger";

interface TripayConfig {
  apiKey: string;
  privateKey: string;
  merchantCode: string;
}

const BASE = {
  sandbox: "https://tripay.co.id/api-sandbox",
  live: "https://tripay.co.id/api",
} as const;

/**
 * Adapter Tripay (closed payment). Signature pembuatan transaksi:
 * HMAC-SHA256(merchantCode + merchantRef + amount, privateKey).
 * Signature webhook: HMAC-SHA256(rawBody, privateKey) pada header X-Callback-Signature.
 */
export class TripayAdapter implements PaymentAdapter {
  readonly id = "TRIPAY" as const;

  constructor(
    private readonly config: TripayConfig,
    readonly mode: "sandbox" | "live",
  ) {}

  private get baseUrl() {
    return BASE[this.mode];
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const signature = createHmac("sha256", this.config.privateKey)
      .update(`${this.config.merchantCode}${input.orderNumber}${input.totalIdr}`)
      .digest("hex");

    const body = {
      method: input.method ?? "QRIS",
      merchant_ref: input.orderNumber,
      amount: input.totalIdr,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: "08100000000",
      order_items: input.items.map((item, index) => ({
        sku: `item-${index + 1}`,
        name: item.name.slice(0, 60),
        price: item.priceIdr,
        quantity: item.quantity,
      })),
      callback_url: `${process.env.APP_URL}/api/webhooks/tripay`,
      return_url: input.returnUrl,
      expired_time: Math.floor(Date.now() / 1000) + input.expiresInMinutes * 60,
      signature,
    };

    const res = await this.request<{ success: boolean; data?: Record<string, unknown>; message?: string }>(
      "/transaction/create",
      { method: "POST", body: JSON.stringify(body) },
    );

    if (!res.success || !res.data) {
      throw new PaymentProviderError("TRIPAY", res.message ?? "Gagal membuat transaksi Tripay", true);
    }
    const data = res.data as {
      reference: string;
      checkout_url?: string;
      pay_code?: string;
      pay_name?: string;
      expired_time?: number;
    };
    if (!data.reference) throw new PaymentProviderError("TRIPAY", "Reference Tripay tidak ditemukan");

    return {
      providerRef: data.reference,
      checkoutUrl: data.checkout_url ?? null,
      payCode: data.pay_code ?? null,
      method: data.pay_name ?? input.method ?? null,
      expiresAt: new Date((data.expired_time ?? Math.floor(Date.now() / 1000) + input.expiresInMinutes * 60) * 1000),
      raw: data,
    };
  }

  async getStatus(providerRef: string): Promise<StatusCheckResult> {
    const res = await this.request<{ success: boolean; data?: Record<string, unknown>; message?: string }>(
      `/transaction/detail?reference=${encodeURIComponent(providerRef)}`,
      { method: "GET" },
    );
    if (!res.success || !res.data) {
      throw new PaymentProviderError("TRIPAY", res.message ?? "Status Tripay tidak tersedia", true);
    }
    const data = res.data as { status?: string; amount?: number };
    return {
      status: mapTripayStatus(data.status ?? ""),
      amountIdr: typeof data.amount === "number" ? data.amount : null,
      providerRef,
      raw: data,
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookResult> {
    const signature = headers["x-callback-signature"] ?? "";
    const expected = createHmac("sha256", this.config.privateKey).update(rawBody).digest("hex");
    const signatureValid = signature.length > 0 && safeCompare(signature, expected);
    const eventHeader = headers["x-callback-event"] ?? "payment_status";

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      logger.warn("tripay_webhook_invalid_json");
    }

    const reference = typeof payload.reference === "string" ? payload.reference : null;
    const merchantRef = typeof payload.merchant_ref === "string" ? payload.merchant_ref : null;
    const rawStatus = typeof payload.status === "string" ? payload.status : "";
    // Callback Tripay menggunakan field `amount` (bukan `total_amount`).
    // Field `total_amount` tidak ada pada payload callback standard.
    const totalAmount = typeof payload.amount === "number" ? payload.amount : null;

    return {
      signatureValid,
      eventType: `${eventHeader}:${rawStatus || "unknown"}`,
      dedupeKey: `TRIPAY:${reference ?? merchantRef ?? "unknown"}:${rawStatus}:${payload.paid_at ?? ""}`,
      providerRef: reference,
      orderNumber: merchantRef,
      status: mapTripayStatus(rawStatus),
      amountIdr: totalAmount,
      method: typeof payload.payment_name === "string" ? payload.payment_name : null,
      raw: payload,
    };
  }

  async availableMethods() {
    return [
      { code: "QRIS", label: "QRIS (semua e-wallet & m-banking)", group: "QRIS" },
      { code: "BRIVA", label: "BRI Virtual Account", group: "Virtual Account" },
      { code: "BNIVA", label: "BNI Virtual Account", group: "Virtual Account" },
      { code: "BSIVA", label: "BSI Virtual Account", group: "Virtual Account" },
      { code: "GOPAY", label: "GoPay", group: "E-Wallet" },
      { code: "OVO", label: "OVO", group: "E-Wallet" },
      { code: "DANA", label: "DANA", group: "E-Wallet" },
      { code: "SHOPEEPAY", label: "ShopeePay", group: "E-Wallet" },
    ];
  }

  private async request<T>(path: string, init: { method: string; body?: string }): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: init.body,
        signal: controller.signal,
      });
      const json = (await res.json()) as T;
      if (!res.ok) {
        logger.warn("tripay_http_error", { status: res.status, path });
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapTripayStatus(status: string): "PAID" | "PENDING" | "FAILED" | "EXPIRED" | "DISPUTED" {
  switch ((status ?? "").toUpperCase()) {
    case "PAID":
      return "PAID";
    case "UNPAID":
      return "PENDING";
    case "EXPIRED":
      return "EXPIRED";
    case "REFUND":
      return "DISPUTED";
    case "FAILED":
    default:
      return "FAILED";
  }
}

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
