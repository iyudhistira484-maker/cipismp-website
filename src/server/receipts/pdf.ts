/**
 * Generator PDF minimal tanpa dependensi: invoice/kuitansi satu halaman atau
 * lebih, memakai font standar PDF (Helvetica) sehingga tidak perlu embed font.
 * Semua teks di-escape dan dibatasi ke ASCII (nama pemain Minecraft & teks
 * transaksi selalu ASCII; karakter lain diganti).
 */
import { formatDateWIB, formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";

export interface ReceiptLine {
  name: string;
  description?: string;
  amountIdr: number;
}

export interface ReceiptData {
  orderNumber: string;
  issuedAt: Date;
  paidAt: Date | null;
  status: string;
  customerName: string;
  customerEmail: string;
  minecraftName: string;
  minecraftUuid: string;
  seasonName: string;
  seasonEndsAt: Date;
  lines: ReceiptLine[];
  subtotalIdr: number;
  discountIdr: number;
  taxIdr: number;
  taxLabel: string;
  feeIdr: number;
  totalIdr: number;
  paymentProvider: string;
  paymentRef: string;
  paymentMethod: string;
  accentNote?: string;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LINE_HEIGHT = 15;

function ascii(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdf(input: string): string {
  return ascii(input).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

class ContentBuilder {
  private ops: string[] = [];

  text(
    value: string,
    options: { x?: number; y: number; size?: number; font?: "F1" | "F2"; color?: [number, number, number] },
  ): void {
    const { x = MARGIN, y, size = 10, font = "F1", color = [0.12, 0.11, 0.1] } = options;
    this.ops.push(
      `BT /${font} ${size} Tf ${color[0]} ${color[1]} ${color[2]} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdf(value)}) Tj ET`,
    );
  }

  rightText(value: string, options: { y: number; size?: number; font?: "F1" | "F2"; color?: [number, number, number] }): void {
    const size = options.size ?? 10;
    const width = estimateWidth(ascii(value), size, options.font === "F2");
    this.text(value, { ...options, x: PAGE_WIDTH - MARGIN - width });
  }

  rect(x: number, y: number, width: number, height: number, color: [number, number, number]): void {
    this.ops.push(`${color[0]} ${color[1]} ${color[2]} rg ${x} ${y} ${width} ${height} re f`);
  }

  line(y: number, color: [number, number, number] = [0.85, 0.83, 0.78]): void {
    this.ops.push(`${color[0]} ${color[1]} ${color[2]} RG 0.6 w ${MARGIN} ${y} m ${PAGE_WIDTH - MARGIN} ${y} l S`);
  }

  build(): string {
    return this.ops.join("\n");
  }
}

/** Perkiraan lebar teks Helvetica (cukup akurat untuk perataan kanan). */
function estimateWidth(text: string, size: number, bold = false): number {
  const factor = bold ? 0.55 : 0.5;
  return text.length * size * factor;
}

function buildPages(data: ReceiptData): string[] {
  const pages: string[] = [];
  const itemsPerPage = 18;
  const chunks: ReceiptLine[][] = [];
  for (let i = 0; i < data.lines.length; i += itemsPerPage) chunks.push(data.lines.slice(i, i + itemsPerPage));
  if (chunks.length === 0) chunks.push([]);

  chunks.forEach((lines, index) => {
    const builder = new ContentBuilder();
    let y = PAGE_HEIGHT - MARGIN;

    builder.rect(0, PAGE_HEIGHT - 120, PAGE_WIDTH, 120, [0.055, 0.051, 0.043]);
    builder.text("CipiSMP", { x: MARGIN, y: y - 10, size: 22, font: "F2", color: [0.88, 0.66, 0.31] });
    builder.text("Kuitansi pembelian", { x: MARGIN, y: y - 30, size: 11, color: [0.85, 0.82, 0.76] });
    builder.text("cipismp.my.id", { x: MARGIN, y: y - 46, size: 9, color: [0.65, 0.62, 0.56] });
    builder.rightText(data.orderNumber, { y: y - 10, size: 12, font: "F2", color: [1, 1, 1] });
    builder.rightText(`Status: ${data.status}`, { y: y - 28, size: 9, color: [0.85, 0.82, 0.76] });
    builder.rightText(`Diterbitkan ${formatDateTimeWIB(data.issuedAt)} WIB`, {
      y: y - 44,
      size: 8,
      color: [0.65, 0.62, 0.56],
    });
    if (index > 0) builder.rightText(`Halaman ${index + 1}`, { y: y - 58, size: 8, color: [0.65, 0.62, 0.56] });

    y = PAGE_HEIGHT - 150;
    const colRight = PAGE_WIDTH - MARGIN;
    builder.text("Pembeli", { x: MARGIN, y, size: 9, color: [0.45, 0.43, 0.39] });
    builder.text("Pemain", { x: 300, y, size: 9, color: [0.45, 0.43, 0.39] });

    y -= 16;
    builder.text(data.customerName, { x: MARGIN, y, size: 11, font: "F2" });
    builder.text(data.minecraftName, { x: 300, y, size: 11, font: "F2" });
    y -= 14;
    builder.text(data.customerEmail, { x: MARGIN, y, size: 9.5, color: [0.3, 0.29, 0.26] });
    builder.text(`UUID ${data.minecraftUuid}`, { x: 300, y, size: 8, color: [0.3, 0.29, 0.26] });
    y -= 12;
    builder.text(
      `Season: ${data.seasonName} (berakhir ${formatDateWIB(data.seasonEndsAt)})`,
      { x: 300, y, size: 9, color: [0.3, 0.29, 0.26] },
    );

    y -= 30;
    builder.line(y);
    y -= 20;
    builder.text("Item", { x: MARGIN, y, size: 9, font: "F2", color: [0.35, 0.33, 0.3] });
    builder.text("Jumlah", { x: 360, y, size: 9, font: "F2", color: [0.35, 0.33, 0.3] });
    builder.text("Harga", { x: colRight - 60, y, size: 9, font: "F2", color: [0.35, 0.33, 0.3] });
    y -= 6;
    builder.line(y);
    y -= 18;

    for (const line of lines) {
      builder.text(line.name, { x: MARGIN, y, size: 10 });
      if (line.description) builder.text(line.description, { x: MARGIN, y: y - 11, size: 8, color: [0.45, 0.43, 0.39] });
      builder.text("1", { x: 362, y, size: 10 });
      builder.rightText(formatRp(line.amountIdr), { y, size: 10 });
      y -= line.description ? 30 : 22;
    }

    if (index === chunks.length - 1) {
      y -= 8;
      builder.line(y);
      y -= 20;
      const row = (label: string, value: string, bold = false) => {
        builder.text(label, { x: 320, y, size: bold ? 11 : 10, font: bold ? "F2" : "F1" });
        builder.rightText(value, { y, size: bold ? 11 : 10, font: bold ? "F2" : "F1" });
        y -= 16;
      };
      row("Subtotal", formatRp(data.subtotalIdr));
      if (data.discountIdr > 0) row("Diskon", `-${formatRp(data.discountIdr)}`);
      if (data.taxIdr > 0) row(`${data.taxLabel}`, formatRp(data.taxIdr));
      if (data.feeIdr > 0) row("Biaya layanan", formatRp(data.feeIdr));
      builder.line(y + 4);
      y -= 14;
      row("Total dibayar", formatRp(data.totalIdr), true);

      y -= 12;
      builder.text("Pembayaran", { x: MARGIN, y, size: 9, color: [0.45, 0.43, 0.39] });
      y -= 14;
      builder.text(`${data.paymentProvider} - ${data.paymentMethod || "metode gateway"}`, { x: MARGIN, y, size: 9.5 });
      y -= 12;
      builder.text(`Referensi ${data.paymentRef}`, { x: MARGIN, y, size: 8.5, color: [0.3, 0.29, 0.26] });
      if (data.paidAt) {
        y -= 12;
        builder.text(`Dibayar ${formatDateTimeWIB(data.paidAt)} WIB`, { x: MARGIN, y, size: 8.5, color: [0.3, 0.29, 0.26] });
      }
    }

    builder.rect(MARGIN, MARGIN + 26, PAGE_WIDTH - MARGIN * 2, 0.8, [0.85, 0.83, 0.78]);
    builder.text(
      "Semua pembelian bersifat final dan tidak dapat direfund. Rank dan kit berlaku sampai akhir season.",
      { x: MARGIN, y: MARGIN + 12, size: 8, color: [0.45, 0.43, 0.39] },
    );
    builder.text("CipiSMP tidak berafiliasi dengan Mojang AB atau Microsoft.", {
      x: MARGIN,
      y: MARGIN,
      size: 8,
      color: [0.55, 0.53, 0.49],
    });

    pages.push(builder.build());
  });

  return pages;
}

export function buildReceiptPdf(data: ReceiptData): Buffer {
  const pageContents = buildPages(data);
  const objects: string[] = [];
  const pageCount = pageContents.length;
  // 1: catalog, 2: pages, 3..(2+n): page, fonts di akhir
  const firstPageObj = 3;
  const fontRegular = firstPageObj + pageCount * 2;
  const fontBold = fontRegular + 1;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

  pageContents.forEach((content, index) => {
    const contentObjNum = firstPageObj + index * 2 + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentObjNum} 0 R >>`,
    );
    objects.push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
