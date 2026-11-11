export interface PaymentMethodOption {
  code: string;
  label: string;
  group: string;
}

export const TRIPAY_METHODS = [
  { code: "QRIS", label: "QRIS (semua e-wallet & m-banking)", group: "QRIS" },
  { code: "BRIVA", label: "BRI Virtual Account", group: "Virtual Account" },
  { code: "BNIVA", label: "BNI Virtual Account", group: "Virtual Account" },
  { code: "BSIVA", label: "BSI Virtual Account", group: "Virtual Account" },
  { code: "GOPAY", label: "GoPay", group: "E-Wallet" },
  { code: "OVO", label: "OVO", group: "E-Wallet" },
  { code: "DANA", label: "DANA", group: "E-Wallet" },
  { code: "SHOPEEPAY", label: "ShopeePay", group: "E-Wallet" },
] as const satisfies readonly PaymentMethodOption[];

export const MIDTRANS_METHODS = [
  { code: "qris", label: "QRIS", group: "QRIS" },
  { code: "bca_va", label: "BCA Virtual Account", group: "Virtual Account" },
  { code: "bni_va", label: "BNI Virtual Account", group: "Virtual Account" },
  { code: "bri_va", label: "BRI Virtual Account", group: "Virtual Account" },
  { code: "gopay", label: "GoPay", group: "E-Wallet" },
  { code: "shopeepay", label: "ShopeePay", group: "E-Wallet" },
] as const satisfies readonly PaymentMethodOption[];

export const FAKE_METHODS = [
  { code: "QRIS", label: "QRIS (simulasi)", group: "QRIS" },
  { code: "VA", label: "Virtual Account (simulasi)", group: "Virtual Account" },
] as const satisfies readonly PaymentMethodOption[];

export function filterPaymentMethods(
  methods: readonly PaymentMethodOption[],
  selectedCodes: readonly string[],
): PaymentMethodOption[] {
  const selected = new Set(selectedCodes);
  return methods.filter((method) => selected.has(method.code));
}
