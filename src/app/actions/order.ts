"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertSameOrigin } from "@/server/csrf";
import { cancelOrder, getOrderOwnershipByPublicToken } from "@/server/orders";
import { getViewer } from "@/server/auth/guard";

export async function cancelOrderAction(formData: FormData): Promise<void> {
  const requestHeaders = await headers();
  assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: requestHeaders }));

  const token = String(formData.get("token") ?? "");
  const order = await getOrderOwnershipByPublicToken(token);
  if (!order) return;

  const viewer = await getViewer();
  // Pemilik akun atau pemegang tautan (tamu) boleh membatalkan order yang belum dibayar.
  if (order.userId && viewer?.user.id !== order.userId) return;

  await cancelOrder(order.id, order.userId ?? null);
  revalidatePath(`/pesanan/${token}`);
}
