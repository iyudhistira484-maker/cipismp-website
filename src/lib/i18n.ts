/**
 * i18n minimal: seluruh string antarmuka ada di kamus ini, ditambah konten produk
 * dari database. Menambah bahasa = menambah kamus baru dan mengubah `locale`.
 */
export const locale = "id" as const;
export type Locale = "id" | "en";

const id = {
  "nav.home": "Beranda",
  "nav.ranks": "Rank",
  "nav.kits": "Kit",
  "nav.how": "Cara kerja",
  "nav.faq": "FAQ",
  "nav.cart": "Keranjang",
  "nav.login": "Masuk",
  "nav.dashboard": "Dashboard",
  "nav.admin": "Admin",
  "nav.logout": "Keluar",
  "cta.buy": "Beli",
  "cta.addToCart": "Tambah ke keranjang",
  "cta.checkout": "Lanjut ke pembayaran",
  "cta.viewAll": "Lihat semua",
  "cta.copy": "Salin",
  "store.seasonActive": "Season aktif",
  "store.endingSoon": "Pembelian ditutup",
  "store.frozen": "Pembelian ditutup menjelang akhir season.",
  "cart.title": "Keranjang",
  "cart.empty": "Keranjang masih kosong",
  "cart.subtotal": "Subtotal",
  "cart.discount": "Diskon",
  "cart.tax": "Pajak",
  "cart.fee": "Biaya layanan",
  "cart.total": "Total",
  "cart.remove": "Hapus",
  "checkout.title": "Pembayaran",
  "order.pending": "Menunggu pembayaran",
  "order.delivered": "Selesai",
  "footer.disclaimer": "Tidak berafiliasi dengan Mojang AB atau Microsoft.",
  "footer.noRefund": "Semua pembelian bersifat final dan tidak dapat direfund.",
  "error.generic": "Terjadi kesalahan. Coba lagi sebentar lagi.",
} as const;

export type MessageKey = keyof typeof id;

const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  id,
  // Placeholder terstruktur untuk bahasa Inggris (ditambahkan saat dibutuhkan).
  en: Object.fromEntries(Object.entries(id).map(([k, v]) => [k, v])) as Record<MessageKey, string>,
};

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let value = dictionaries[locale][key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
}
