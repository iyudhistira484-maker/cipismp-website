/**
 * Tipe & antarmuka adapter pembayaran. Tidak ada metode refund — penjualan final.
 * Adapter hanya bertanggung jawab soal uang; perubahan status order diurus oleh
 * `order-service.ts` supaya aturan state machine tetap satu pintu.
 */
export type ProviderId = "TRIPAY" | "MIDTRANS" | "FAKE";

export interface CreatePaymentInput {
  orderNumber: string;
  totalIdr: number;
  customerName: string;
  customerEmail: string;
  description: string;
  items: Array<{ name: string; priceIdr: number; quantity: number }>;
  method?: string | null;
  returnUrl: string;
  expiresInMinutes: number;
}

export interface CreatePaymentResult {
  providerRef: string;
  checkoutUrl: string | null;
  payCode: string | null;
  method: string | null;
  expiresAt: Date;
  raw: Record<string, unknown>;
}

export type NormalizedPaymentStatus = "PAID" | "PENDING" | "FAILED" | "EXPIRED" | "DISPUTED";

export interface WebhookResult {
  signatureValid: boolean;
  eventType: string;
  /** Kunci unik untuk idempotensi: provider + event + referensi. */
  dedupeKey: string;
  providerRef: string | null;
  orderNumber: string | null;
  status: NormalizedPaymentStatus;
  amountIdr: number | null;
  method: string | null;
  reason?: string;
  raw: Record<string, unknown>;
}

export interface StatusCheckResult {
  status: NormalizedPaymentStatus;
  amountIdr: number | null;
  providerRef: string;
  raw: Record<string, unknown>;
}

export interface PaymentAdapter {
  readonly id: ProviderId;
  readonly mode: "sandbox" | "live";
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getStatus(providerRef: string, orderNumber: string): Promise<StatusCheckResult>;
  /**
   * Verifikasi webhook. Implementasi WAJIB memeriksa tanda tangan dan tidak boleh
   * melempar error untuk payload tidak valid — kembalikan signatureValid: false.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookResult>;
  /** Metode pembayaran yang ditawarkan ke pembeli. */
  availableMethods(): Promise<Array<{ code: string; label: string; group: string }>>;
}

export class PaymentProviderError extends Error {
  constructor(
    public readonly provider: ProviderId,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

/** Urutan status untuk menentukan apakah sebuah pembayaran "sudah lunas". */
export function isPaidStatus(status: NormalizedPaymentStatus): boolean {
  return status === "PAID";
}
