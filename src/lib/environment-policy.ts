/** Simulated payments are available only to development/test, never production. */
export function simulationAllowed(nodeEnv: string | undefined, appEnv: string | undefined): boolean {
  return nodeEnv !== "production" && appEnv !== "production";
}

/** Validate the deployment profile without inspecting or exposing secrets. */
export function productionConfigurationErrors(input: {
  appEnv: string;
  nodeEnv: string;
  minecraftLookupMode: string;
  paymentDefaultProvider: string;
  emailProvider: string;
}): string[] {
  if (input.appEnv !== "production") return [];
  const errors: string[] = [];
  if (input.nodeEnv !== "production") errors.push("APP_ENV=production memerlukan NODE_ENV=production");
  if (input.minecraftLookupMode !== "offline") errors.push("CipiSMP produksi memerlukan MINECRAFT_LOOKUP_MODE=offline");
  if (input.paymentDefaultProvider === "FAKE") errors.push("Gateway simulasi tidak tersedia di produksi");
  if (input.emailProvider === "outbox") errors.push("Email produksi memerlukan provider resend atau smtp, bukan outbox");
  return errors;
}
