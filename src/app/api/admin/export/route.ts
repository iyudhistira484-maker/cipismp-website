import { NextResponse } from "next/server";
import { parseWibDate } from "@/lib/admin-export-date";
import { requireViewerApi } from "@/server/auth/guard";
import { hasPermission } from "@/server/rbac";
import { writeAudit } from "@/server/audit";
import { clientIp } from "@/server/csrf";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { customersCsv, ordersCsv } from "@/server/admin/export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewerApi();
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "orders";
    if (type !== "orders" && type !== "customers") {
      return NextResponse.json({ error: "Jenis ekspor tidak dikenal." }, { status: 400 });
    }
    const permission = type === "customers" ? "customers.read" : "orders.read";
    if (!viewer.user.totpEnabledAt || !hasPermission(viewer.user.role, permission)) {
      return NextResponse.json({ error: "Tidak punya akses ekspor ini." }, { status: 403 });
    }

    try {
      await enforceRateLimit(`export:${viewer.user.id}`, 6, 60);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json({ error: "Terlalu banyak ekspor. Coba lagi sebentar." }, { status: 429 });
      }
      throw error;
    }

    const fromValue = url.searchParams.get("from");
    const toValue = url.searchParams.get("to");
    if (type === "customers" && (fromValue || toValue)) {
      return NextResponse.json({ error: "Filter tanggal hanya tersedia untuk ekspor pesanan." }, { status: 400 });
    }
    const parsedFrom = parseWibDate(fromValue);
    const parsedTo = parseWibDate(toValue, true);
    if (!parsedFrom.valid || !parsedTo.valid) {
      return NextResponse.json({ error: "Tanggal harus valid dengan format YYYY-MM-DD (WIB)." }, { status: 400 });
    }
    const from = parsedFrom.date;
    const to = parsedTo.date;
    if (from && to && from.getTime() > to.getTime()) {
      return NextResponse.json({ error: "Rentang tanggal tidak valid." }, { status: 400 });
    }

    const result = type === "customers" ? await customersCsv() : await ordersCsv({ from, to });

    await writeAudit({
      actor: { id: viewer.user.id, label: viewer.user.username || viewer.user.email },
      action: "data.export",
      targetType: type === "customers" ? "customers" : "orders",
      after: {
        rows: result.rowCount,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
      ip: clientIp(new Headers(request.headers)),
      userAgent: request.headers.get("user-agent"),
    });

    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Terlalu banyak ekspor. Coba lagi sebentar." }, { status: 429 });
    }
    if (error instanceof Error && error.name === "UnauthenticatedError") {
      return NextResponse.json({ error: "Harus masuk sebagai staf." }, { status: 401 });
    }
    return NextResponse.json({ error: "Ekspor gagal." }, { status: 500 });
  }
}
