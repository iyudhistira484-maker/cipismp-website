export interface FaqEntry {
  id: string;
  category: "rank-dan-season" | "pemain-dan-pengiriman" | "pembayaran-dan-refund";
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqEntry[] = [
  {
    id: "season-berakhir",
    category: "rank-dan-season",
    question: "Apa yang terjadi pada rank saya saat season berakhir?",
    answer:
      "Semua rank dan kit berakhir bersama season, lalu dihapus dari akunmu sebelum season berikutnya dimulai. Tidak ada perpanjangan otomatis dan tidak ada diskon pembelian ulang — rank season baru dibeli terpisah.",
  },
  {
    id: "upgrade",
    category: "rank-dan-season",
    question: "Bagaimana cara upgrade rank?",
    answer:
      "Pilih tier yang lebih tinggi; sistem menghitung dan menagih hanya selisih harga setelah rank yang sedang dimiliki diperhitungkan. Upgrade ke tier yang lebih rendah tidak bisa dilakukan, dan membeli rank yang sama dua kali diblokir sistem.",
  },
  {
    id: "bedrock",
    category: "pemain-dan-pengiriman",
    question: "Saya main dari HP atau konsol. Bisa beli?",
    answer:
      "Bisa. Bedrock terhubung lewat Geyser/Floodgate. Hubungkan akun di dashboard dengan nama yang tampil di server, termasuk awalan _ Floodgate untuk Bedrock, dan pilih edisi yang benar. Masuk ke server, selesaikan /login melalui LoginSecurity, lalu gunakan kode /verify. Java dan Bedrock sama-sama perlu login. Nama dengan spasi belum didukung untuk pengiriman otomatis.",
  },
  {
    id: "pengiriman",
    category: "pemain-dan-pengiriman",
    question: "Berapa lama akses rank atau kit aktif setelah saya bayar?",
    answer:
      "Setelah pembayaran terverifikasi, pengiriman permission rank atau akses PlayerKits diproses otomatis. Jika server atau pemain belum siap, pengiriman menunggu; masuk ke server dan selesaikan /login melalui LoginSecurity, lalu pantau status pesanan. Waktu pengiriman dapat bervariasi. CipiPrime dan Cipi++ diklaim lewat PlayerKits dengan cooldown 5 jam yang dikelola server.",
  },
  {
    id: "refund",
    category: "pembayaran-dan-refund",
    question: "Bisa refund kalau berubah pikiran?",
    answer:
      "Tidak. Semua pembelian bersifat final dan tidak dapat direfund, termasuk kalau akunmu kemudian melanggar aturan server. Karena itu kami menampilkan masa aktif dan isi item sedetail mungkin sebelum kamu membayar.",
  },
  {
    id: "gagal",
    category: "pemain-dan-pengiriman",
    question: "Sudah bayar tapi akses atau reward belum aktif. Apa yang harus saya lakukan?",
    answer:
      "Buka halaman status pesanan dari tautan di email dan pastikan kamu sudah masuk ke server serta /login melalui LoginSecurity. Jika akses masih belum aktif, hubungi email bantuan dengan nomor pesanan. Jangan membayar lagi tanpa arahan; staf akan memeriksa status pengiriman terlebih dahulu.",
  },
  {
    id: "hadiah",
    category: "pemain-dan-pengiriman",
    question: "Bisa membeli untuk teman?",
    answer:
      "Jika fitur hadiah diaktifkan, kamu bisa memilih penerima saat membeli produk. Penerima harus sudah menghubungkan akun Minecraft di server dan memenuhi syarat produk. Staf serta akun alternatif staf yang dikenali tidak dapat menerima hadiah rank.",
  },
  {
    id: "pembayaran",
    category: "pembayaran-dan-refund",
    question: "Metode pembayaran apa yang tersedia?",
    answer:
      "QRIS, virtual account bank (BCA, BNI, BRI, dan bank yang didukung gateway), serta e-wallet populer seperti GoPay, OVO, DANA, dan ShopeePay. Metode yang tampil mengikuti konfigurasi gateway yang aktif.",
  },
];
