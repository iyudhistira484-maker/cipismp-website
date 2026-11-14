"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertSameOrigin, clientIp } from "@/server/csrf";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { getCartIdentity, getCartLines, clearCart } from "@/server/cart";
import { getSettings } from "@/server/settings";
import { getViewer } from "@/server/auth/guard";
import { getCurrentSession } from "@/server/auth/session";
import { createOrder, CheckoutError, findOrderForLookup } from "@/server/orders";
import { ProviderUnavailableError, type ProviderId } from "@/server/payments";
import { InvalidUsernameError } from "@/server/minecraft";

export interface CheckoutState {
  error?: string;
  fields?: Record<string, string>;
}

const checkoutSchema = z.object({
  mcEdition: z.enum(["JAVA", "BEDROCK"]).optional(),
  mcName: z.string().trim().min(3, "Username Minecraft wajib diisi.").max(32),
  email: z.string().trim().email("Format email tidak valid."),
  provider: z.enum(["TRIPAY", "MIDTRANS", "FAKE"]),
  method: z.string().max(40).optional(),
  couponCode: z.string().trim().max(40).optional(),
  noRefund: z.literal("on", { errorMap: () => ({ message: "Persetujuan wajib dicentang." }) }),
  terms: z.literal("on", { errorMap: () => ({ message: "Persetujuan wajib dicentang." }) }),
  marketingOptIn: z.string().optional(),
});

export async function checkoutAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const requestHeaders = await headers();
  assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: requestHeaders }));
  const ip = clientIp(requestHeaders);

  const raw = {
    mcName: String(formData.get("mcName") ?? ""),
    mcEdition: String(formData.get("mcEdition") ?? "") || undefined,
    email: String(formData.get("email") ?? ""),
    provider: String(formData.get("provider") ?? ""),
    method: String(formData.get("method") ?? "") || undefined,
    couponCode: String(formData.get("couponCode") ?? "") || undefined,
    noRefund: formData.get("noRefund"),
    terms: formData.get("terms"),
    marketingOptIn: formData.get("marketingOptIn") ?? undefined,
  };

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] = issue.message;
    return { error: "Periksa kembali data yang diisi.", fields };
  }

  try {
    await enforceRateLimit(`checkout:${ip}`, 8, 60);
    await enforceRateLimit(`checkout-email:${parsed.data.email.toLowerCase()}`, 5, 300);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: "Terlalu banyak percobaan checkout. Tunggu sebentar lalu coba lagi." };
    }
    throw error;
  }

  const [identity, settings, viewer, current] = await Promise.all([getCartIdentity(), getSettings(), getViewer(), getCurrentSession()]);
  if (current?.user.totpEnabledAt && !current.session.mfaSatisfiedAt) {
    return { error: "Selesaikan verifikasi 2FA sebelum checkout." };
  }
  if (viewer && !viewer.user.emailVerifiedAt) {
    return { error: "Verifikasi email akun sebelum checkout, atau keluar untuk checkout sebagai tamu." };
  }
  const lines = await getCartLines(identity.cartId);
  if (!identity.cartId || lines.length === 0) return { error: "Keranjang kosong." };
  if (lines.some((line) => line.isGift && !line.targetName?.trim())) {
    return { error: "Penerima hadiah tidak tersedia. Hapus item hadiah dari keranjang dan tambahkan kembali." };
  }

  try {
    const result = await createOrder({
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        targetName: line.isGift ? line.targetName : null,
        targetUuid: line.isGift ? line.targetUuid : null,
      })),
      mcName: parsed.data.mcName,
      mcEdition: parsed.data.mcEdition,
      email: parsed.data.email,
      couponCode: parsed.data.couponCode ?? null,
      userId: viewer?.user.id ?? null,
      provider: parsed.data.provider as ProviderId,
      method: parsed.data.method ?? null,
      ip,
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
      noRefundAccepted: parsed.data.noRefund === "on",
      legalVersions: {
        tos: settings.legal.tosVersion,
        privacy: settings.legal.privacyVersion,
        sales: settings.legal.salesVersion,
      },
    });
    await clearCart(identity.cartId);
    redirect(result.paymentUrl ?? `/pesanan/${encodeURIComponent(result.order.publicToken)}`);
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message, fields: error.fields };
    if (error instanceof InvalidUsernameError) return { error: error.message, fields: { mcName: error.message } };
    if (error instanceof ProviderUnavailableError) return { error: error.message };
    if (error instanceof RateLimitError) {
      return { error: "Terlalu banyak percobaan checkout. Tunggu sebentar lalu coba lagi." };
    }
    throw error;
  }
}

/** Cek status pesanan tamu: nomor order + email, lalu arahkan ke halaman bertoken. */
export async function lookupOrderAction(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const orderNumber = String(formData.get("orderNumber") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!orderNumber || !email) return { error: "Nomor order dan email wajib diisi." };

  try {
    await enforceRateLimit(`order-lookup:${email}`, 10, 300);
  } catch {
    return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  }

  const order = await findOrderForLookup(orderNumber, email);
  if (!order) return { error: "Pesanan tidak ditemukan. Periksa nomor order dan email yang dipakai saat membeli." };
  redirect(`/pesanan/${order.publicToken}`);
}
