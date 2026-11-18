/** A blank secret retains the stored value only when the mode is unchanged. */
export function resolveMidtransSignatureSecret(
  entered: string,
  mode: "sandbox" | "live",
  existing: { mode: "sandbox" | "live"; config: Record<string, string> } | null,
): string {
  const secret = entered.trim();
  return secret || (existing?.mode === mode ? (existing.config.signatureSecretKey ?? "").trim() : "");
}
