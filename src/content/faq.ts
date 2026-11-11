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
    question: "Bagaimana cara upgrade rank?",
    answer:
      "Pilih tier yang lebih tinggi; sistem menghitung dan menagih hanya selisih harga setelah rank yang sedang dimiliki diperhitungkan. Upgrade ke tier yang lebih rendah tidak bisa dilakukan, dan membeli rank yang sama dua kali diblokir sistem.",
  },
  {
    id: "bedrock",
    question: "Saya main dari HP atau konsol. Bisa beli?",
    answer:
      "Bisa. Bedrock terhubung lewat Geyser/Floodgate, jadi nama kamu punya awalan titik (contoh .CipiPlayer). Tulis nama lengkap dengan titiknya di checkout; kalau tanpa titik, kami mengenali nama yang mengandung spasi sebagai Bedrock.",
  },
  {
    id: "pengiriman",
    question: "Berapa lama akses rank atau kit aktif setelah saya bayar?",
    answer:
      "Biasanya di bawah satu menit setelah pembayaran terverifikasi gateway. Permission rank atau PlayerKits dikirim otomatis ke server; kalau server sedang restart atau kamu sedang offline, perintah diantrekan. CipiPrime dan Cipi++ diklaim lewat PlayerKits dengan cooldown 5 jam yang dikelola server.",
  },
  {
    id: "refund",
    question: "Bisa refund kalau berubah pikiran?",
    answer:
      "Tidak. Semua pembelian bersifat final dan tidak dapat direfund, termasuk kalau akunmu kemudian melanggar aturan server. Karena itu kami menampilkan masa aktif dan isi item sedetail mungkin sebelum kamu membayar.",
  },
  {
    id: "gagal",
    question: "Sudah bayar tapi akses atau reward belum aktif. Apa yang harus saya lakukan?",
    answer:
      "Buka halaman status pesanan dari tautan di email. Kalau status sudah PAID tetapi permission belum aktif, tekan Laporan di halaman itu atau kirim nomor order ke email bantuan. Kami tidak akan meminta pembayaran kedua; staf dapat mengirim ulang perintah aktivasi.",
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
