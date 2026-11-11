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

interface MidtransConfig {
  serverKey: string;
  clientKey: string;
}

const SNAP = {
  sandbox: "https://app.sandbox.midtrans.com",
  live: "https://app.midtrans.com",
} as const;
const API = {
  sandbox: "https://api.sandbox.midtrans.com",
  live: "https://api.midtrans.com",
} as const;

/**
 * Adapter Midtrans Snap. Signature notifikasi:
 * SHA512(order_id + status_code + gross_amount + serverKey).
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
      ...(input.method ? { enabled_payments: [input.method] } : {}),
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
    });
    const json = (await res.json().catch(() => ({}))) as {
      transaction_status?: string;
      fraud_status?: string;
      gross_amount?: string;
    };
    if (!res.ok) {
      throw new PaymentProviderError("MIDTRANS", `Status Midtrans gagal (${res.status})`, true);
    }
    return {
      status: mapMidtransStatus(json.transaction_status ?? "", json.fraud_status ?? ""),
      amountIdr: json.gross_amount ? Math.round(Number.parseFloat(json.gross_amount)) : null,
      providerRef: orderNumber,
      raw: json as Record<string, unknown>,
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
      .update(`${orderId}${statusCode}${grossAmount}${this.config.serverKey}`)
      .digest("hex");
    const signatureValid = provided.length > 0 && safeCompare(provided, expected);

    const transactionStatus = String(payload.transaction_status ?? "");
    const fraudStatus = String(payload.fraud_status ?? "");
    const amount = grossAmount ? Math.round(Number.parseFloat(grossAmount)) : null;

    return {
      signatureValid,
      eventType: `notification:${transactionStatus || "unknown"}`,
      dedupeKey: `MIDTRANS:${String(payload.transaction_id ?? orderId)}:${transactionStatus}:${fraudStatus}:${statusCode}:${String(payload.gross_amount ?? "")}`,
      providerRef: String(payload.transaction_id ?? "") || null,
      orderNumber: orderId || null,
      status: mapMidtransStatus(transactionStatus, fraudStatus),
      amountIdr: Number.isFinite(amount) ? amount : null,
      method: typeof payload.payment_type === "string" ? payload.payment_type : null,
      raw: payload,
    };
  }

  async availableMethods() {
    return [
      { code: "qris", label: "QRIS", group: "QRIS" },
      { code: "bca_va", label: "BCA Virtual Account", group: "Virtual Account" },
      { code: "bni_va", label: "BNI Virtual Account", group: "Virtual Account" },
      { code: "bri_va", label: "BRI Virtual Account", group: "Virtual Account" },
      { code: "gopay", label: "GoPay", group: "E-Wallet" },
      { code: "shopeepay", label: "ShopeePay", group: "E-Wallet" },
    ];
  }
}

export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus: string,
): "PAID" | "PENDING" | "FAILED" | "EXPIRED" | "DISPUTED" {
  const status = (transactionStatus ?? "").toLowerCase();
  const fraud = (fraudStatus ?? "").toLowerCase();
  if (status === "capture") return fraud === "challenge" ? "PENDING" : "PAID";
  if (status === "settlement") return "PAID";
  if (status === "pending") return "PENDING";
  if (status === "expire") return "EXPIRED";
  if (status === "refund" || status === "chargeback" || status === "partial_refund") return "DISPUTED";
  if (status === "deny" || status === "cancel" || status === "failure") return "FAILED";
  return "PENDING";
}
