"use server";

import { getCartIdentity, getCartLines } from "@/server/cart";
import { priceCurrentCart } from "@/server/pricing-service";
import { normalizeUsername } from "@/server/minecraft";
import { getViewer } from "@/server/auth/guard";
import { env } from "@/server/env";

export interface PreviewResult {
  ok: boolean;
  errors: string[];
  lines: Array<{ cartItemId: string | null; productId: string; name: string; amountIdr: number; note?: string }>;
  subtotalIdr: number;
  discountIdr: number;
  taxIdr: number;
  feeIdr: number;
  totalIdr: number;
  couponApplied: string | null;
  discountLabel: string | null;
  discountKind: "COUPON" | "AUTOMATIC" | null;
}

/**
 * Pratinjau total di halaman checkout. Nominal final tetap dihitung ulang saat
 * order dibuat — pratinjau ini hanya untuk tampilan.
 */
export async function previewTotalsAction(input: {
  mcName: string;
  couponCode?: string;
}): Promise<PreviewResult> {
  const empty: PreviewResult = {
    ok: false,
    errors: [],
    lines: [],
    subtotalIdr: 0,
    discountIdr: 0,
    taxIdr: 0,
    feeIdr: 0,
    totalIdr: 0,
    couponApplied: null,
    discountLabel: null,
    discountKind: null,
  };

  const identity = await getCartIdentity();
  if (!identity.cartId) return { ...empty, errors: ["Keranjang kosong."] };
  const lines = await getCartLines(identity.cartId);
  if (lines.length === 0) return { ...empty, errors: ["Keranjang kosong."] };

  let uuid = "";
  let name = "";
  try {
    const { resolvePlayer } = await import("@/server/minecraft");
    const player = await resolvePlayer(input.mcName);
    if (env.MINECRAFT_LOOKUP_MODE === "offline" && player.source !== "cache") {
      return { ...empty, errors: ["Hubungkan akun Minecraft di dashboard sebelum checkout."] };
    }
    uuid = player.uuid;
    name = player.name;
  } catch {
    if (env.MINECRAFT_LOOKUP_MODE === "offline") return { ...empty, errors: ["Nama atau profil Minecraft tidak dapat dipastikan. Hubungi bantuan."] };
    try {
      const normalized = normalizeUsername(input.mcName);
      const { deterministicUuid } = await import("@/server/minecraft");
      name = normalized.name;
      uuid = deterministicUuid(name, normalized.edition);
    } catch {
      return { ...empty, errors: ["Masukkan username Minecraft yang valid."] };
    }
  }

  const viewer = await getViewer();
  const pricing = await priceCurrentCart({
    cartId: identity.cartId,
    targetUuid: uuid,
    targetName: name,
    couponCode: input.couponCode?.trim() || null,
    buyerEmail: viewer?.user.email ?? null,
    buyerUserId: viewer?.user.id ?? null,
  });

  return {
    ok: pricing.result.ok,
    errors: pricing.result.errors.map((error) => error.message),
    lines: pricing.result.lines.map((line) => ({
      cartItemId: lines.find((item) => item.productId === line.productId && (item.targetUuid ?? uuid).toLowerCase() === line.targetUuid.toLowerCase())?.id ?? null,
      productId: line.productId,
      name: line.name,
      amountIdr: line.lineTotalIdr,
      note: line.upgradeFrom
        ? `Upgrade dari ${line.upgradeFrom.name}`
        : line.targetName !== name
          ? `Hadiah untuk ${line.targetName}`
          : undefined,
    })),
    subtotalIdr: pricing.result.subtotalIdr,
    discountIdr: pricing.result.discountIdr,
    taxIdr: pricing.result.taxIdr,
    feeIdr: pricing.result.feeIdr,
    totalIdr: pricing.result.totalIdr,
    couponApplied: pricing.result.couponCode,
    discountLabel: pricing.result.discountLabel,
    discountKind: pricing.result.discountKind,
  };
}
