/**
 * Template email transaksional. HTML tabel sederhana + inline style agar aman di
 * Gmail/Outlook, plus versi plain-text. Warna mengikuti token brand.
 */
import { formatDateWIB, formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";

const BRAND = {
  bg: "#fefbfd",
  card: "#ffffff",
  text: "#342732",
  muted: "#695865",
  accent: "#a02b64",
  success: "#26745b",
  line: "#eddde7",
};

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(input: { title: string; preheader: string; bodyHtml: string; footerNote?: string }): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.line};">
      <tr><td style="padding:28px 32px 8px;">
        <div style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.accent};font-weight:700;">CipiSMP</div>
      </td></tr>
      <tr><td style="padding:0 32px 8px;">
        <h1 style="margin:8px 0 0;font-size:23px;line-height:1.3;color:${BRAND.text};font-weight:650;">${escapeHtml(input.title)}</h1>
      </td></tr>
      <tr><td style="padding:12px 32px 28px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        ${input.bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 32px 26px;border-top:1px solid ${BRAND.line};color:${BRAND.muted};font-size:12px;line-height:1.6;">
        ${input.footerNote ? `<p style="margin:0 0 10px;">${input.footerNote}</p>` : ""}
        <p style="margin:0;">CipiSMP Store · cipismp.my.id<br/>Tidak berafiliasi dengan Mojang AB atau Microsoft.</p>
        <p style="margin:6px 0 0;">Semua pembelian bersifat final dan tidak dapat direfund.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;"><tr>
    <td style="border-radius:10px;background:${BRAND.accent};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr></table>
    <p style="margin:8px 0 0;font-size:12px;color:${BRAND.muted};word-break:break-all;">${escapeHtml(href)}</p>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;">${text}</p>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;color:${BRAND.muted};font-size:13px;">${escapeHtml(label)}</td>
    <td style="padding:7px 0;color:${BRAND.text};font-size:13px;text-align:right;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

export function verifyEmailTemplate(input: { username: string; url: string; expiryMinutes: number }): EmailContent {
  return {
    subject: "Verifikasi email CipiSMP Store",
    html: layout({
      title: "Aktifkan akun kamu",
      preheader: "Satu klik untuk mengaktifkan akun CipiSMP Store.",
      bodyHtml:
        p(`Halo <strong>${escapeHtml(input.username)}</strong>,`) +
        p("Klik tombol di bawah untuk memverifikasi email dan mengaktifkan akun CipiSMP Store.") +
        button(input.url, "Verifikasi email") +
        p(`Tautan berlaku ${input.expiryMinutes} menit dan hanya bisa dipakai sekali.`),
    }),
    text: `Halo ${input.username},\n\nVerifikasi email CipiSMP Store: ${input.url}\n\nTautan berlaku ${input.expiryMinutes} menit.`,
  };
}

export function resetPasswordTemplate(input: { username: string; url: string; expiryMinutes: number }): EmailContent {
  return {
    subject: "Atur ulang password CipiSMP Store",
    html: layout({
      title: "Atur ulang password",
      preheader: "Tautan reset password berlaku 45 menit.",
      bodyHtml:
        p(`Halo <strong>${escapeHtml(input.username)}</strong>,`) +
        p("Kami menerima permintaan untuk mengatur ulang password akun CipiSMP Store kamu.") +
        button(input.url, "Buat password baru") +
        p(`Tautan berlaku ${input.expiryMinutes} menit. Setelah password diganti, semua sesi lain otomatis dikeluarkan.`) +
        p("Kalau kamu tidak meminta ini, abaikan email ini — password kamu tidak berubah."),
      footerNote: "Demi keamanan, kami tidak pernah menanyakan password lewat email.",
    }),
    text: `Halo ${input.username},\n\nAtur ulang password CipiSMP Store: ${input.url}\n\nBerlaku ${input.expiryMinutes} menit. Semua sesi lain akan dikeluarkan.`,
  };
}

export function emailChangeTemplate(input: { username: string; url: string; newEmail: string }): EmailContent {
  return {
    subject: "Konfirmasi perubahan email CipiSMP Store",
    html: layout({
      title: "Konfirmasi email baru",
      preheader: "Konfirmasi alamat email baru akun CipiSMP Store.",
      bodyHtml:
        p(`Halo <strong>${escapeHtml(input.username)}</strong>,`) +
        p(`Kami menerima permintaan perubahan email menjadi <strong>${escapeHtml(input.newEmail)}</strong>.`) +
        button(input.url, "Konfirmasi email baru") +
        p("Setelah dikonfirmasi, verifikasi email wajib dilakukan ulang sebelum checkout."),
    }),
    text: `Konfirmasi perubahan email CipiSMP Store ke ${input.newEmail}: ${input.url}`,
  };
}

export function loginAlertTemplate(input: { username: string; ip: string; device: string; at: Date }): EmailContent {
  return {
    subject: "Login baru di akun CipiSMP Store",
    html: layout({
      title: "Login dari perangkat baru",
      preheader: "Kalau ini bukan kamu, segera ganti password.",
      bodyHtml:
        p(`Halo <strong>${escapeHtml(input.username)}</strong>,`) +
        p("Ada login baru ke akun CipiSMP Store kamu.") +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7fb;border:1px solid ${BRAND.line};border-radius:10px;padding:14px 18px;margin:14px 0;">
          ${detailRow("Waktu", `${formatDateTimeWIB(input.at)} WIB`)}
          ${detailRow("Perangkat", input.device)}
          ${detailRow("IP", input.ip)}
        </table>` +
        p("Kalau itu bukan kamu, ganti password dan keluarkan semua sesi dari halaman Keamanan."),
    }),
    text: `Login baru CipiSMP Store\nWaktu: ${formatDateTimeWIB(input.at)} WIB\nPerangkat: ${input.device}\nIP: ${input.ip}`,
  };
}

export interface OrderEmailData {
  orderNumber: string;
  playerName: string;
  seasonName: string;
  seasonEndsAt: Date;
  subtotalIdr: number;
  discountIdr: number;
  discountLabel: string | null;
  totalIdr: number;
  items: Array<{ name: string; type: "RANK" | "KIT"; amountIdr: number }>;
  statusUrl: string;
  paymentUrl?: string | null;
  method?: string | null;
  payCode?: string | null;
  expiresAt?: Date | null;
}

function orderSummary(data: OrderEmailData): string {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:9px 0;color:${BRAND.text};font-size:14px;">${escapeHtml(item.name)}
          <span style="color:${BRAND.muted};font-size:12px;display:block;">${item.type === "RANK" ? "Rank" : "Kit"} · ${escapeHtml(data.seasonName)}</span>
        </td>
        <td style="padding:9px 0;color:${BRAND.text};font-size:14px;text-align:right;">${escapeHtml(formatRp(item.amountIdr))}</td>
      </tr>`,
    )
    .join("");
  const subtotal = `<tr><td style="padding:7px 0;color:${BRAND.muted};font-size:13px;">Subtotal</td>
      <td style="padding:7px 0;color:${BRAND.text};font-size:13px;text-align:right;">${escapeHtml(formatRp(data.subtotalIdr))}</td></tr>`;
  const discount = data.discountIdr > 0
    ? `<tr><td style="padding:7px 0;color:${BRAND.success};font-size:13px;">Diskon${data.discountLabel ? ` (${escapeHtml(data.discountLabel)})` : ""}</td>
      <td style="padding:7px 0;color:${BRAND.success};font-size:13px;text-align:right;">−${escapeHtml(formatRp(data.discountIdr))}</td></tr>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;">
    ${rows}
    ${subtotal}
    ${discount}
    <tr><td style="padding-top:12px;border-top:1px solid ${BRAND.line};color:${BRAND.muted};font-size:13px;">Total</td>
    <td style="padding-top:12px;border-top:1px solid ${BRAND.line};color:${BRAND.accent};font-size:16px;text-align:right;font-weight:700;">${escapeHtml(formatRp(data.totalIdr))}</td></tr>
  </table>
  <p style="margin:10px 0 0;color:${BRAND.muted};font-size:12px;">Aktif sampai akhir ${escapeHtml(data.seasonName)}, berakhir ${escapeHtml(formatDateWIB(data.seasonEndsAt))}.</p>`;
}

export function orderCreatedTemplate(data: OrderEmailData): EmailContent {
  return {
    subject: `Selesaikan pembayaran ${data.orderNumber}`,
    html: layout({
      title: "Pesanan dibuat",
      preheader: `Order ${data.orderNumber} menunggu pembayaran.`,
      bodyHtml:
        p(`Halo <strong>${escapeHtml(data.playerName)}</strong>, pesanan kamu sudah dibuat dan menunggu pembayaran.`) +
        orderSummary(data) +
        (data.payCode ? p(`Kode pembayaran: <strong>${escapeHtml(data.payCode)}</strong>`) : "") +
        (data.method ? p(`Metode: ${escapeHtml(data.method)}`) : "") +
        (data.expiresAt ? p(`Bayar sebelum ${escapeHtml(formatDateTimeWIB(data.expiresAt))} WIB.`) : "") +
        (data.paymentUrl ? button(data.paymentUrl, "Buka halaman pembayaran") : "") +
        p("Setelah pembayaran terverifikasi, akses rank atau permission kit dikirim otomatis ke server."),
    }),
    text: `Pesanan ${data.orderNumber} menunggu pembayaran.\nTotal: ${formatRp(data.totalIdr)}\n${data.paymentUrl ?? ""}`,
  };
}

export function orderPaidTemplate(data: OrderEmailData): EmailContent {
  return {
    subject: `Pembayaran diterima — ${data.orderNumber}`,
    html: layout({
      title: "Pembayaran diterima",
      preheader: `Order ${data.orderNumber} sudah dibayar dan sedang diproses.`,
      bodyHtml:
        p(`Halo <strong>${escapeHtml(data.playerName)}</strong>, pembayaran untuk order <strong>${escapeHtml(data.orderNumber)}</strong> sudah kami terima.`) +
        orderSummary(data) +
        p("Akses rank atau permission PlayerKits sedang dikirim ke server. Jika kamu offline, plugin akan mencoba aktivasi saat kamu masuk berikutnya; periksa status pesanan atau hubungi bantuan jika belum aktif.") +
        button(data.statusUrl, "Lihat status pesanan"),
    }),
    text: `Pembayaran diterima untuk ${data.orderNumber}. Total ${formatRp(data.totalIdr)}.\nStatus: ${data.statusUrl}`,
  };
}

export function orderDeliveredTemplate(data: OrderEmailData): EmailContent {
  return {
    subject: `Pesanan selesai — ${data.orderNumber}`,
    html: layout({
      title: "Akses sudah diaktifkan",
      preheader: `Order ${data.orderNumber} selesai.`,
      bodyHtml:
        p(`Halo <strong>${escapeHtml(data.playerName)}</strong>, perintah aktivasi untuk order <strong>${escapeHtml(data.orderNumber)}</strong> sudah dijalankan di server.`) +
        orderSummary(data) +
        p("Masuk ke server untuk menggunakan rank atau permission PlayerKits. CipiPrime dan Cipi++ diklaim lewat PlayerKits dengan cooldown 5 jam. Kalau permission belum aktif, buka halaman status pesanan dan hubungi kami dengan nomor order di atas.") +
        button(data.statusUrl, "Lihat pesanan"),
    }),
    text: `Order ${data.orderNumber} selesai dan akses diaktifkan.`,
  };
}

export function orderFailedTemplate(data: OrderEmailData): EmailContent {
  return {
    subject: `Pengiriman tertunda — ${data.orderNumber}`,
    html: layout({
      title: "Pengiriman sedang ditangani",
      preheader: "Tim kami sedang menangani pengiriman pesanan kamu.",
      bodyHtml:
        p(`Halo <strong>${escapeHtml(data.playerName)}</strong>, pembayaran kamu sudah kami terima, tetapi pengiriman otomatis untuk order <strong>${escapeHtml(data.orderNumber)}</strong> belum berhasil.`) +
        p("Tim CipiSMP sudah diberi tahu dan akan mengirim ulang. Tidak perlu membayar lagi.") +
        button(data.statusUrl, "Lihat status pesanan"),
    }),
    text: `Pembayaran ${data.orderNumber} diterima. Pengiriman akan diulang oleh tim.`,
  };
}

export function seasonEndingTemplate(input: {
  username: string;
  seasonName: string;
  endsAt: Date;
  daysLeft: number;
  storeUrl: string;
}): EmailContent {
  return {
    subject: `${input.seasonName} berakhir dalam ${input.daysLeft} hari`,
    html: layout({
      title: `${input.seasonName} hampir selesai`,
      preheader: `Season berakhir ${formatDateWIB(input.endsAt)}.`,
      bodyHtml:
        p(`Halo <strong>${escapeHtml(input.username)}</strong>,`) +
        p(
          `${escapeHtml(input.seasonName)} berakhir ${escapeHtml(formatDateWIB(input.endsAt))} pukul 23.59 WIB. Semua rank dan kit dari season ini berakhir bersama season dan tidak berpindah ke season berikutnya.`,
        ) +
        p("Pembelian ditutup 3 hari sebelum season berakhir.") +
        button(input.storeUrl, "Buka toko"),
    }),
    text: `${input.seasonName} berakhir ${formatDateWIB(input.endsAt)}. Semua rank & kit season ini ikut berakhir.`,
  };
}

export function staffInviteTemplate(input: { username: string; inviter: string; role: string; url: string }): EmailContent {
  return {
    subject: "Akses staf CipiSMP Store",
    html: layout({
      title: "Akses staf diberikan",
      preheader: `${input.inviter} memberi kamu akses staf.`,
      bodyHtml:
        p(`Halo <strong>${escapeHtml(input.username)}</strong>,`) +
        p(`${escapeHtml(input.inviter)} memberi kamu akses <strong>${escapeHtml(input.role)}</strong> ke panel admin CipiSMP Store.`) +
        p("Dua faktor (2FA) wajib diaktifkan sebelum panel bisa dipakai.") +
        button(input.url, "Atur password & aktifkan 2FA"),
    }),
    text: `Akses ${input.role} diberikan. Atur di: ${input.url}`,
  };
}

export function compGrantTemplate(input: {
  username: string;
  productName: string;
  seasonName: string;
  endsAt: Date;
  reason: string;
}): EmailContent {
  return {
    subject: `Item ditambahkan: ${input.productName}`,
    html: layout({
      title: "Item ditambahkan ke akunmu",
      preheader: `${input.productName} sudah aktif untuk ${input.seasonName}.`,
      bodyHtml:
        p(`Halo <strong>${escapeHtml(input.username)}</strong>,`) +
        p(`Tim CipiSMP menambahkan <strong>${escapeHtml(input.productName)}</strong> ke akunmu untuk ${escapeHtml(input.seasonName)}.`) +
        p(
          `<span style="color:${BRAND.muted};font-size:13px;">Aktif sampai akhir ${escapeHtml(input.seasonName)}, berakhir ${escapeHtml(formatDateWIB(input.endsAt))}. Alasan: ${escapeHtml(input.reason)}</span>`,
        ),
    }),
    text: `${input.productName} ditambahkan untuk ${input.seasonName}. Alasan: ${input.reason}`,
  };
}
