"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requirePermissionApi, requireVerifiedViewer, requireViewer } from "@/server/auth/guard";
import { assertSameOrigin, clientIp } from "@/server/csrf";
import { enforceRateLimit } from "@/server/rate-limit";
import { ReviewError, setReviewStatus, submitReview } from "@/server/reviews";
import { writeAudit } from "@/server/audit";
import { getSettings } from "@/server/settings";
import { getProductById } from "@/server/catalog";
import { db } from "@/server/db";
import { products } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export interface ReviewState {
  error?: string;
  success?: string;
}

function fail(error: unknown, fallback = "Ulasan gagal disimpan."): ReviewState {
  if (error instanceof ReviewError) return { error: error.message };
  if (error instanceof Error && error.name === "RateLimitError") {
    return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  }
  if (error instanceof Error && error.name === "ForbiddenError") return { error: error.message };
  console.error("[reviews] action failed", error);
  return { error: fallback };
}

export async function submitReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  try {
    const requestHeaders = await headers();
    assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: requestHeaders }));
    const settings = await getSettings();
    if (!settings.features.reviews) return { error: "Ulasan sedang dinonaktifkan oleh admin." };

    const viewer = await requireVerifiedViewer();
    await enforceRateLimit(`review:${viewer.user.id}`, 5, 3600);

    const parsed = z
      .object({
        productId: z.string().min(1, "Produk tidak dikenal."),
        rating: z.coerce.number().int().min(1).max(5),
        body: z.string().min(15, "Ulasan minimal 15 karakter.").max(1200, "Ulasan maksimal 1200 karakter."),
      })
      .safeParse({
        productId: String(formData.get("productId") ?? ""),
        rating: formData.get("rating"),
        body: String(formData.get("body") ?? "").trim(),
      });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data ulasan tidak valid." };

    const product = await getProductById(parsed.data.productId);
    if (!product) return { error: "Produk tidak ditemukan." };

    await submitReview({
      userId: viewer.user.id,
      productId: product.id,
      rating: parsed.data.rating,
      body: parsed.data.body,
    });

    await writeAudit({
      actor: { id: viewer.user.id, label: viewer.user.email },
      action: "review.submitted",
      targetType: "product",
      targetId: product.id,
      after: { rating: parsed.data.rating },
      ip: clientIp(requestHeaders),
    });

    revalidatePath(`/rank/${product.slug}`);
    revalidatePath(`/kit/${product.slug}`);
    return { success: "Terima kasih! Ulasanmu menunggu moderasi sebelum tampil." };
  } catch (error) {
    return fail(error);
  }
}

export async function adminModerateReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  try {
    const requestHeaders = await headers();
    assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: requestHeaders }));
    const viewer = await requirePermissionApi("products.write");
    await requireViewer();
    await enforceRateLimit(`review-mod:${viewer.user.id}`, 60, 300);

    const parsed = z
      .object({
        reviewId: z.string().min(1),
        status: z.enum(["APPROVED", "HIDDEN"]),
      })
      .safeParse({
        reviewId: String(formData.get("reviewId") ?? ""),
        status: String(formData.get("status") ?? ""),
      });
    if (!parsed.success) return { error: "Aksi moderasi tidak valid." };

    await setReviewStatus(parsed.data.reviewId, parsed.data.status);
    await writeAudit({
      actor: { id: viewer.user.id, label: viewer.user.email },
      action: parsed.data.status === "APPROVED" ? "review.approved" : "review.hidden",
      targetType: "review",
      targetId: parsed.data.reviewId,
      ip: clientIp(requestHeaders),
    });

    revalidatePath("/admin/ulasan");
    revalidatePath("/rank");
    revalidatePath("/kit");
    return { success: parsed.data.status === "APPROVED" ? "Ulasan ditampilkan di halaman produk." : "Ulasan disembunyikan." };
  } catch (error) {
    return fail(error, "Moderasi gagal.");
  }
}

/** Dipakai form ulasan untuk memastikan produk punya slug yang benar. */
export async function resolveProductSlug(productId: string): Promise<string | null> {
  const rows = await db.select({ slug: products.slug }).from(products).where(eq(products.id, productId)).limit(1);
  return rows[0]?.slug ?? null;
}
