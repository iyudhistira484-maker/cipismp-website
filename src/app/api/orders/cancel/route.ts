import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/server/csrf";
import { getViewer } from "@/server/auth/guard";
import { cancelOrder, getOrderOwnershipByPublicToken } from "@/server/orders";

// Native POST/redirect/GET ensures the browser reloads the authoritative status
// even when a client-router transition stalls after the mutation has succeeded.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const value = form?.get("token");
  const token = typeof value === "string" ? value : "";
  if (!token || token.length > 256) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  const order = await getOrderOwnershipByPublicToken(token);
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  const viewer = await getViewer();
  if (order.userId && viewer?.user.id !== order.userId) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  await cancelOrder(order.id, order.userId ?? null);
  return new Response(null, {
    status: 303,
    headers: { Location: `/pesanan/${encodeURIComponent(token)}`, "Cache-Control": "no-store" },
  });
}
