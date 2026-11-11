import { and, desc, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { orders, users } from "../db/schema";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";

/** Escaping CSV RFC 4180 + BOM agar Excel membaca UTF-8 dengan benar. */
export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const escape = (value: string | number | null): string => {
    if (value === null || value === undefined) return "";
    let text = String(value);
    // Cegah CSV/formula injection saat file dibuka di Excel/Sheets: teks yang diawali
    // =, +, -, @, tab, atau CR tidak boleh dieksekusi sebagai formula.
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function isoDate(date: Date | null): string {
  return date ? date.toISOString() : "";
}

export interface ExportRange {
  from?: Date;
  to?: Date;
}

export async function ordersCsv(range: ExportRange = {}): Promise<{ filename: string; csv: string; rowCount: number }> {
  const conditions: SQL[] = [];
  if (range.from) conditions.push(gte(orders.createdAt, range.from));
  if (range.to) conditions.push(lte(orders.createdAt, range.to));

  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      status: orders.status,
      email: orders.email,
      mcName: orders.mcName,
      mcUuid: orders.mcUuid,
      edition: orders.edition,
      provider: orders.provider,
      subtotalIdr: orders.subtotalIdr,
      discountIdr: orders.discountIdr,
      taxIdr: orders.taxIdr,
      feeIdr: orders.feeIdr,
      totalIdr: orders.totalIdr,
      couponCode: orders.couponCode,
      seasonId: orders.seasonId,
      adminNote: orders.adminNote,
    })
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(10_000);

  const csv = toCsv(
    [
      "nomor_order",
      "dibuat",
      "dibayar",
      "status",
      "email",
      "pemain",
      "uuid",
      "edisi",
      "gateway",
      "subtotal_idr",
      "diskon_idr",
      "pajak_idr",
      "biaya_idr",
      "total_idr",
      "kupon",
      "season_id",
      "catatan_admin",
    ],
    rows.map((row) => [
      row.orderNumber,
      isoDate(row.createdAt),
      isoDate(row.paidAt),
      ORDER_STATUS_LABEL[row.status as OrderStatus] ?? row.status,
      row.email,
      row.mcName,
      row.mcUuid,
      row.edition,
      row.provider ?? "",
      row.subtotalIdr,
      row.discountIdr,
      row.taxIdr,
      row.feeIdr,
      row.totalIdr,
      row.couponCode ?? "",
      row.seasonId,
      row.adminNote ?? "",
    ]),
  );

  return { filename: `pesanan-${new Date().toISOString().slice(0, 10)}.csv`, csv, rowCount: rows.length };
}

export async function customersCsv(): Promise<{ filename: string; csv: string; rowCount: number }> {
  const rows = await db
    .select({
      email: users.email,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
      emailVerifiedAt: users.emailVerifiedAt,
      totpEnabledAt: users.totpEnabledAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(10_000);

  const spend = await db
    .select({
      email: orders.email,
      total: sql<string>`coalesce(sum(${orders.totalIdr}), 0)`,
      totalOrders: sql<string>`count(*)`,
    })
    .from(orders)
    .where(inArray(orders.status, ["PAID", "DELIVERING", "DELIVERED", "DISPUTED"]))
    .groupBy(orders.email);
  const spendMap = new Map(spend.map((row) => [row.email.toLowerCase(), row]));

  const csv = toCsv(
    [
      "email",
      "username",
      "role",
      "dibuat",
      "email_terverifikasi",
      "2fa_aktif",
      "login_terakhir",
      "total_belanja_idr",
      "jumlah_order_dibayar",
    ],
    rows.map((row) => {
      const paid = spendMap.get(row.email.toLowerCase());
      return [
        row.email,
        row.username,
        row.role,
        isoDate(row.createdAt),
        row.emailVerifiedAt ? "ya" : "belum",
        row.totpEnabledAt ? "ya" : "tidak",
        isoDate(row.lastLoginAt),
        paid ? Number(paid.total) : 0,
        paid ? Number(paid.totalOrders) : 0,
      ];
    }),
  );

  return { filename: `pelanggan-${new Date().toISOString().slice(0, 10)}.csv`, csv, rowCount: rows.length };
}
