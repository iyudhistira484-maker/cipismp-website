import {
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentAdapter,
  type StatusCheckResult,
  type WebhookResult,
} from "./types";
import { FAKE_METHODS } from "@/lib/payment-methods";

/**
 * Provider palsu untuk development & test: membuat halaman pembayaran lokal yang
 * memicu webhook bertanda tangan ke store sendiri, sehingga seluruh alur
 * (termasuk verifikasi signature dan idempotensi) diuji tanpa kredensial asli.
 */
export class FakeAdapter implements PaymentAdapter {
  readonly id = "FAKE" as const;
  readonly mode = "sandbox" as const;

  constructor(private readonly secret: string) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const ref = `FAKE-${input.orderNumber}-${Date.now().toString(36)}`;
    return {
      providerRef: ref,
      checkoutUrl: `/api/fake/checkout/${encodeURIComponent(ref)}`,
      payCode: null,
      method: input.method ?? "QRIS",
      expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000),
      raw: { reference: ref },
    };
  }

  async getStatus(providerRef: string): Promise<StatusCheckResult> {
    // Provider palsu tidak menyimpan status; status diambil dari database lokal.
    return { status: "PENDING", amountIdr: null, providerRef, raw: { simulated: true } };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookResult> {
    const signature = headers["x-fake-signature"] ?? "";
    const expected = await this.sign(rawBody);
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      // biarkan kosong; signatureValid akan false bila body tidak valid
    }
    return {
      signatureValid: signature === expected && rawBody.length > 0,
      eventType: `fake:${String(payload.status ?? "unknown")}`,
      // Nominal ikut jadi bagian dedupe key: pembayaran kurang lalu dilunasi harus diproses,
      // sementara replay event identik tetap diabaikan.
      dedupeKey: `FAKE:${String(payload.reference ?? "")}:${String(payload.status ?? "")}:${String(payload.amount ?? "")}`,
      providerRef: String(payload.reference ?? "") || null,
      orderNumber: String(payload.merchant_ref ?? "") || null,
      status:
        payload.status === "PAID"
          ? "PAID"
          : payload.status === "EXPIRED"
            ? "EXPIRED"
            : payload.status === "FAILED"
              ? "FAILED"
              : "PENDING",
      amountIdr: typeof payload.amount === "number" ? payload.amount : null,
      method: "QRIS",
      raw: payload,
    };
  }

  async availableMethods() {
    return [...FAKE_METHODS];
  }

  /** Body webhook contoh yang ditandatangani dengan secret yang sama. */
  async buildWebhookBody(input: {
    reference: string;
    merchantRef: string;
    amount: number;
    status: "PAID" | "EXPIRED" | "FAILED";
  }): Promise<{ body: string; signature: string }> {
    const body = JSON.stringify({
      reference: input.reference,
      merchant_ref: input.merchantRef,
      amount: input.amount,
      status: input.status,
      paid_at: new Date().toISOString(),
    });
    return { body, signature: await this.sign(body) };
  }

  private async sign(body: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}
