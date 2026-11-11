import { NextResponse } from "next/server";
import { requireViewerApi } from "@/server/auth/guard";
import { hasPermission } from "@/server/rbac";
import { writeAudit } from "@/server/audit";
import { clientIp } from "@/server/csrf";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { customersCsv, ordersCsv } from "@/server/admin/export";

export const dynamic = "force-dynamic";

function parseDate(value: string | null, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  // Tanggal dianggap WIB; untuk batas akhir, sertakan seluruh hari tersebut.
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+07:00`);
}

export async function GET(request: Request) {
  try {
    const viewer = await requireViewerApi();
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "orders";
    const permission = type === "customers" ? "customers.read" : "orders.read";
    if (!hasPermission(viewer.user.role, permission)) {
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

    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"), true);
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
