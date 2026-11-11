export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqEntry[] = [
  {
    id: "season-berakhir",
    question: "Apa yang terjadi pada rank saya saat season berakhir?",
    answer:
      "Semua rank dan kit berakhir bersama season, lalu dihapus dari akunmu sebelum season berikutnya dimulai. Tidak ada perpanjangan otomatis dan tidak ada diskon pembelian ulang — rank season baru dibeli terpisah.",
  },
  {
    id: "upgrade",
    question: "Saya sudah punya Iron. Berapa harga untuk upgrade ke Gold?",
    answer:
      "Hanya selisihnya. Gold Rp 45.000 dikurangi Iron Rp 20.000, jadi yang dibayar Rp 25.000. Upgrade ke tier yang lebih rendah tidak bisa dilakukan, dan membeli rank yang sama dua kali diblokir sistem.",
  },
  {
    id: "bedrock",
    question: "Saya main dari HP atau konsol. Bisa beli?",
    answer:
      "Bisa. Bedrock terhubung lewat Geyser/Floodgate, jadi nama kamu punya awalan titik (contoh .CipiPlayer). Tulis nama lengkap dengan titiknya di checkout; kalau tanpa titik, kami mengenali nama yang mengandung spasi sebagai Bedrock.",
  },
  {
    id: "pengiriman",
    question: "Berapa lama item masuk setelah saya bayar?",
    answer:
      "Biasanya di bawah satu menit setelah pembayaran terverifikasi gateway. Kalau server sedang restart atau kamu sedang offline, perintah diantrekan dan dijalankan otomatis saat server siap atau saat kamu login berikutnya.",
  },
  {
    id: "refund",
    question: "Bisa refund kalau berubah pikiran?",
    answer:
      "Tidak. Semua pembelian bersifat final dan tidak dapat direfund, termasuk kalau akunmu kemudian melanggar aturan server. Karena itu kami menampilkan masa aktif dan isi item sedetail mungkin sebelum kamu membayar.",
  },
  {
    id: "gagal",
    question: "Sudah bayar tapi item belum masuk. Apa yang harus saya lakukan?",
    answer:
      "Buka halaman status pesanan dari tautan di email. Kalau status sudah PAID tetapi item belum masuk, tekan Laporan di halaman itu atau kirim nomor order ke email bantuan. Kami tidak akan meminta pembayaran kedua; solusinya selalu pengiriman ulang.",
  },
  {
    id: "hadiah",
    question: "Bisa membeli untuk teman?",
    answer:
      "Belum di season ini. Fitur hadiah sedang disiapkan, dan aturan harga untuk penerima sudah disiapkan di sistem agar tidak ada penyalahgunaan saat fitur dibuka.",
  },
  {
    id: "pembayaran",
    question: "Metode pembayaran apa yang tersedia?",
    answer:
      "QRIS, virtual account bank (BCA, BNI, BRI, dan bank yang didukung gateway), serta e-wallet populer seperti GoPay, OVO, DANA, dan ShopeePay. Metode yang tampil mengikuti konfigurasi gateway yang aktif.",
  },
];
