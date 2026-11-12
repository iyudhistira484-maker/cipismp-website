import { getOrderByPublicToken, getOrderDetail } from "@/server/orders";
import { buildReceiptPdf } from "@/server/receipts/pdf";
import { getSettings } from "@/server/settings";
import { formatDateWIB } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Kuitansi PDF. Hanya bisa diakses dengan token pesanan. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByPublicToken(token);
  if (!order) return new Response("Tidak ditemukan", { status: 404 });
  const detail = await getOrderDetail(order.id);
  if (!detail || !detail.season) return new Response("Tidak ditemukan", { status: 404 });

  const settings = await getSettings();
  const payment = detail.payments[0];

  const pdf = buildReceiptPdf({
    orderNumber: detail.order.orderNumber,
    issuedAt: detail.payments[0]?.paidAt ?? detail.order.createdAt,
    paidAt: detail.order.paidAt,
    status: detail.order.status,
    customerName: detail.order.mcName,
    customerEmail: detail.order.email,
    minecraftName: detail.order.mcName,
    minecraftUuid: detail.order.mcUuid,
    seasonName: detail.season.name,
    seasonEndsAt: detail.season.endAt,
    lines: detail.items.map((item) => ({
      name: item.nameSnapshot,
      description: `${item.type === "RANK" ? "Rank" : "Kit"} - ${detail.season?.name ?? ""} - berakhir ${formatDateWIB(detail.season!.endAt)}`,
      amountIdr: item.lineTotalIdr,
    })),
    subtotalIdr: detail.order.subtotalIdr,
    discountIdr: detail.order.discountIdr,
    discountLabel: detail.order.couponCode
      ? `Kupon ${detail.order.couponCode}`
      : detail.order.discountLabel
        ? `Otomatis ${detail.order.discountLabel}`
        : null,
    taxIdr: detail.order.taxIdr,
    taxLabel: `${settings.store.taxLabel} ${settings.store.taxPercent}%`.trim(),
    feeIdr: detail.order.feeIdr,
    totalIdr: detail.order.totalIdr,
    paymentProvider: payment?.provider ?? "—",
    paymentRef: payment?.providerRef ?? "—",
    paymentMethod: payment?.method ?? "",
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="kuitansi-${detail.order.orderNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
