import { createHash } from "node:crypto";
import {
  PaymentProviderError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentAdapter,
  type StatusCheckResult,
  type WebhookResult,
} from "./types";
import { safeCompare } from "./tripay";
import { logger } from "../logger";
import { MIDTRANS_METHODS } from "@/lib/payment-methods";

interface MidtransConfig {
  serverKey: string;
  clientKey: string;
  signatureSecretKey: string;
}

const SNAP = {
  sandbox: "https://app.sandbox.midtrans.com",
  live: "https://app.midtrans.com",
} as const;
const API = {
  sandbox: "https://api.sandbox.midtrans.com",
  live: "https://api.midtrans.com",
} as const;

// Store method codes are stable for existing settings and orders. Snap's
// enabled_payments uses GoPay to offer its QRIS flow; "qris" is a Core API /
// transaction payment_type, not the corresponding Snap channel identifier.
// https://docs.midtrans.com/reference/gopay
const SNAP_PAYMENT_CHANNELS: Record<(typeof MIDTRANS_METHODS)[number]["code"], string> = {
  qris: "gopay",
  bca_va: "bca_va",
  bni_va: "bni_va",
  bri_va: "bri_va",
  gopay: "gopay",
  shopeepay: "shopeepay",
};

/**
 * Adapter Midtrans Snap. Signature notifikasi:
 * SHA512(order_id + status_code + gross_amount + signatureSecretKey).
 */
export class MidtransAdapter implements PaymentAdapter {
  readonly id = "MIDTRANS" as const;

  constructor(
    private readonly config: MidtransConfig,
    readonly mode: "sandbox" | "live",
  ) {}

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.config.serverKey}:`).toString("base64")}`;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    let snapChannel: string | undefined;
    if (input.method) {
      if (!Object.hasOwn(SNAP_PAYMENT_CHANNELS, input.method)) {
        throw new PaymentProviderError("MIDTRANS", "Metode pembayaran Midtrans tidak dikenal.");
      }
      snapChannel = SNAP_PAYMENT_CHANNELS[input.method as keyof typeof SNAP_PAYMENT_CHANNELS];
    }

    const body = {
      transaction_details: { order_id: input.orderNumber, gross_amount: input.totalIdr },
      item_details: input.items.map((item) => ({
        id: item.name.slice(0, 40),
        price: item.priceIdr,
        quantity: item.quantity,
        name: item.name.slice(0, 50),
      })),
      customer_details: {
        first_name: input.customerName.slice(0, 50),
        email: input.customerEmail,
      },
      callbacks: { finish: input.returnUrl, error: input.returnUrl },
      expiry: { unit: "minutes", duration: input.expiresInMinutes },
      ...(snapChannel ? { enabled_payments: [snapChannel] } : {}),
    };

    const res = await fetch(`${SNAP[this.mode]}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as {
      token?: string;
      redirect_url?: string;
      error_messages?: string[];
    };
    if (!res.ok || !json.token) {
      throw new PaymentProviderError(
        "MIDTRANS",
        json.error_messages?.join(", ") ?? `Midtrans menolak transaksi (${res.status})`,
        true,
      );
    }

    return {
      providerRef: json.token,
      checkoutUrl: json.redirect_url ?? null,
      payCode: null,
      method: input.method ?? null,
      expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000),
      raw: json as Record<string, unknown>,
    };
  }

  async getStatus(_providerRef: string, orderNumber: string): Promise<StatusCheckResult> {
    const res = await fetch(`${API[this.mode]}/v2/${encodeURIComponent(orderNumber)}/status`, {
      method: "GET",
      headers: { Authorization: this.authHeader(), Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new PaymentProviderError("MIDTRANS", `Status Midtrans gagal (${res.status})`, true);
    }
    const amountIdr = parseMidtransAmount(json.gross_amount);
    if (json.order_id !== orderNumber || typeof json.transaction_id !== "string" || !json.transaction_id ||
        typeof json.transaction_status !== "string" || !json.transaction_status || amountIdr === null) {
      throw new PaymentProviderError("MIDTRANS", "Respons status Midtrans tidak lengkap atau tidak cocok dengan order.", true);
    }
    return {
      status: mapMidtransStatus(json.transaction_status, typeof json.fraud_status === "string" ? json.fraud_status : ""),
      amountIdr,
      providerRef: json.transaction_id,
      raw: json,
    };
  }

  async verifyWebhook(rawBody: string, _headers: Record<string, string>): Promise<WebhookResult> {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      logger.warn("midtrans_webhook_invalid_json");
    }

    const orderId = String(payload.order_id ?? "");
    const statusCode = String(payload.status_code ?? "");
    const grossAmount = String(payload.gross_amount ?? "");
    const provided = String(payload.signature_key ?? "");
    const expected = createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${this.config.signatureSecretKey}`)
      .digest("hex");
    const signatureValid = this.config.signatureSecretKey.trim().length > 0 && provided.length > 0 && safeCompare(provided, expected);

    const transactionStatus = String(payload.transaction_status ?? "");
    const fraudStatus = String(payload.fraud_status ?? "");
    const amount = parseMidtransAmount(grossAmount);

    return {
      signatureValid,
      eventType: `notification:${transactionStatus || "unknown"}`,
      dedupeKey: `MIDTRANS:${String(payload.transaction_id ?? orderId)}:${transactionStatus}:${fraudStatus}:${statusCode}:${String(payload.gross_amount ?? "")}`,
      providerRef: String(payload.transaction_id ?? "") || null,
      orderNumber: orderId || null,
      status: mapMidtransStatus(transactionStatus, fraudStatus),
      amountIdr: amount,
      method: typeof payload.payment_type === "string" ? payload.payment_type : null,
      raw: payload,
    };
  }

  async availableMethods() {
    return [...MIDTRANS_METHODS];
  }
}

/** IDR is an integer; reject fractional, malformed and unsafe values rather than rounding. */
export function parseMidtransAmount(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:\.0{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus: string,
): "PAID" | "PENDING" | "FAILED" | "EXPIRED" | "DISPUTED" {
  const status = (transactionStatus ?? "").toLowerCase();
  const fraud = (fraudStatus ?? "").toLowerCase();
  if (status === "capture") return fraud === "accept" ? "PAID" : fraud === "deny" ? "FAILED" : "PENDING";
  if (status === "settlement") return "PAID";
  if (status === "pending") return "PENDING";
  if (status === "expire") return "EXPIRED";
  if (status === "refund" || status === "chargeback" || status === "partial_refund") return "DISPUTED";
  if (status === "deny" || status === "cancel" || status === "failure") return "FAILED";
  return "PENDING";
}
