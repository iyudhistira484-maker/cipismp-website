/**
 * Draf teknis dokumen legal. WAJIB direview penasihat hukum sebelum go-live.
 * Versi & tanggal berlaku dibaca dari settings.legal agar penerimaan bisa dilacak.
 */
export interface LegalSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  summary: string;
  versionKey: "tosVersion" | "privacyVersion" | "salesVersion";
  updatedKey: "updatedAt";
  sections: LegalSection[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "syarat-layanan",
    title: "Syarat Layanan",
    summary:
      "Aturan penggunaan akun, pembelian, dan perilaku di server CipiSMP. Dengan membuat akun, kamu menyetujui dokumen ini.",
    versionKey: "tosVersion",
    updatedKey: "updatedAt",
    sections: [
      {
        heading: "1. Layanan yang kami sediakan",
        paragraphs: [
          "CipiSMP Store adalah toko resmi untuk membeli rank dan kit yang berlaku di server Minecraft CipiSMP (Java dan Bedrock, terhubung melalui Geyser/Floodgate). Toko menjual barang virtual yang tidak dapat dipindahkan ke server lain.",
          "Rank dan kit adalah barang digital yang langsung dikirim ke akun Minecraft setelah pembayaran terverifikasi. Rank dan kit tidak memberi keuntungan tempur; semuanya bersifat kenyamanan dan kosmetik.",
        ],
      },
      {
        heading: "2. Akun dan usia minimum",
        paragraphs: [
          "Kamu wajib memberikan email dan username Minecraft yang benar. Identitas pembelian disimpan sebagai UUID Minecraft, sehingga pergantian nama pemain tidak menghilangkan kepemilikan.",
          "Usia minimum untuk membeli adalah 13 tahun. Pemain di bawah usia tersebut wajib mendapat izin orang tua atau wali, dan orang tua/wali bertanggung jawab atas pembayaran.",
        ],
        list: [
          "Satu akun toko tidak boleh dipakai bersama untuk menghindari penyalahgunaan.",
          "Kamu bertanggung jawab menjaga kerahasiaan password dan kode 2FA.",
          "Kami dapat menonaktifkan akun yang terbukti melakukan penipuan pembayaran atau penyalahgunaan sistem.",
        ],
      },
      {
        heading: "3. Aturan server",
        paragraphs: [
          "Pembelian di toko tidak membebaskan kamu dari aturan server. Pelanggaran aturan (cheat, griefing, eksploitasi bug, ujaran kebencian) dapat menyebabkan pembatasan akun tanpa pengembalian dana.",
          "Keputusan moderasi diambil berdasarkan bukti dan dicatat. Banding dapat diajukan melalui email bantuan.",
        ],
      },
      {
        heading: "4. Ketersediaan layanan",
        paragraphs: [
          "Kami berusaha menjaga server tetap online, tetapi pemeliharaan, gangguan hosting, atau pembaruan versi Minecraft dapat menyebabkan downtime. Downtime tidak membuat pembelian batal; item yang belum terkirim dikirim setelah server kembali normal.",
        ],
      },
      {
        heading: "5. Perubahan layanan",
        paragraphs: [
          "Kami dapat menyesuaikan isi kit, harga, dan keuntungan rank antar season. Perubahan tidak berlaku surut terhadap pembelian yang sudah dikirim pada season berjalan.",
          "Season dapat diakhiri lebih cepat dalam keadaan darurat (misalnya kerusakan data yang tidak dapat dipulihkan). Bila itu terjadi, kami memberi tahu melalui Discord dan email.",
        ],
      },
      {
        heading: "6. Batasan tanggung jawab",
        paragraphs: [
          "Tanggung jawab kami atas kerugian yang timbul dari pembelian dibatasi pada nilai pembelian tersebut. Kami tidak bertanggung jawab atas kerugian tidak langsung, termasuk kehilangan item karena kematian di dalam game.",
          "CipiSMP tidak berafiliasi dengan Mojang AB atau Microsoft.",
        ],
      },
      {
        heading: "7. Hukum yang berlaku",
        paragraphs: [
          "Dokumen ini diatur oleh hukum Republik Indonesia. Sengketa diselesaikan terlebih dahulu secara musyawarah melalui email bantuan.",
        ],
      },
    ],
  },
  {
    slug: "kebijakan-privasi",
    title: "Kebijakan Privasi",
    summary:
      "Data apa yang kami kumpulkan, mengapa, berapa lama disimpan, dan hak kamu atas data tersebut.",
    versionKey: "privacyVersion",
    updatedKey: "updatedAt",
    sections: [
      {
        heading: "1. Data yang kami kumpulkan",
        paragraphs: [
          "Kami hanya mengumpulkan data yang diperlukan untuk memproses pembelian dan menjalankan server.",
        ],
        list: [
          "Identitas akun: email, username toko, password (disimpan sebagai hash argon2id, tidak pernah dalam bentuk asli).",
          "Identitas Minecraft: UUID, nama tampilan, edisi (Java/Bedrock).",
          "Data pesanan: produk, nominal, status, gateway, referensi pembayaran, dan waktu transaksi.",
          "Data teknis: alamat IP, user agent, dan log keamanan (percobaan login, sesi).",
          "Email yang kamu terima: verifikasi, kuitansi, pemberitahuan pengiriman, dan pengingat akhir season.",
        ],
      },
      {
        heading: "2. Dasar pemrosesan",
        paragraphs: [
          "Data diproses untuk melaksanakan kontrak (mengirim item yang dibeli), memenuhi kewajiban hukum (pencatatan transaksi), dan menjaga keamanan layanan (pencegahan penipuan). Email promosi hanya dikirim bila kamu memilih ikut.",
        ],
      },
      {
        heading: "3. Pembagian data",
        paragraphs: [
          "Kami tidak menjual data. Data dibagikan hanya kepada pihak yang diperlukan untuk layanan: gateway pembayaran (Tripay/Midtrans), penyedia email transaksional, penyedia hosting, dan layanan verifikasi username Minecraft milik Mojang.",
          "Gateway pembayaran memproses data pembayaran sesuai kebijakan privasi mereka. Kami tidak menyimpan nomor kartu atau kredensial perbankan.",
        ],
      },
      {
        heading: "4. Cookie",
        paragraphs: [
          "Kami memakai cookie yang diperlukan untuk sesi login, keranjang, dan perlindungan CSRF. Cookie ini tidak dipakai untuk iklan. Kami tidak memasang cookie analitik atau pelacak pihak ketiga pada MVP ini, sehingga tidak ada banner cookie yang mengganggu.",
        ],
      },
      {
        heading: "5. Penyimpanan dan keamanan",
        paragraphs: [
          "Data transaksi disimpan selama diperlukan untuk pembukuan dan penyelesaian sengketa. Password disimpan dengan argon2id, sesi disimpan sebagai hash, dan kredensial gateway dienkripsi AES-256-GCM. Akses admin memerlukan 2FA dan dicatat dalam audit log.",
        ],
      },
      {
        heading: "6. Hak kamu",
        paragraphs: [
          "Kamu dapat meminta salinan data, perbaikan data yang salah, atau penghapusan akun melalui email bantuan. Penghapusan akun menghapus data identitas, tetapi catatan transaksi tetap disimpan dalam bentuk yang dibatasi sesuai kewajiban hukum.",
          "Kamu dapat berhenti menerima email promosi kapan saja lewat tautan di email atau pengaturan akun.",
        ],
      },
      {
        heading: "7. Anak di bawah umur",
        paragraphs: [
          "Layanan ini tidak ditujukan untuk anak di bawah 13 tahun. Bila kamu mengetahui ada akun anak di bawah 13 tahun, hubungi kami untuk penghapusan.",
        ],
      },
    ],
  },
  {
    slug: "syarat-penjualan",
    title: "Syarat Penjualan",
    summary:
      "Ketentuan pembelian: masa aktif per season, kebijakan tanpa refund, dan cara penyelesaian bila item gagal dikirim.",
    versionKey: "salesVersion",
    updatedKey: "updatedAt",
    sections: [
      {
        heading: "1. Semua pembelian bersifat final",
        paragraphs: [
          "Tidak ada refund, pembatalan setelah pembayaran, atau pengembalian dana dalam bentuk apa pun. Dengan mencentang pernyataan di checkout, kamu menyatakan memahami hal ini.",
          "Alasan tidak dapat direfund termasuk, tetapi tidak terbatas pada: berubah pikiran, berhenti bermain, akun terkena sanksi karena melanggar aturan server, atau perangkat tidak lagi mendukung Minecraft.",
        ],
      },
      {
        heading: "2. Masa aktif mengikuti season",
        paragraphs: [
          "Rank dan kit berlaku sejak dikirim sampai season berjalan berakhir. Tidak ada perpanjangan otomatis dan tidak ada diskon pembelian ulang. Saat season baru dimulai, semua rank dan kit harus dibeli kembali.",
          "Tanggal berakhir season ditampilkan pada halaman produk, keranjang, checkout, dan kuitansi. Pembelian ditutup pada tiga hari terakhir season.",
        ],
      },
      {
        heading: "3. Harga dan pembayaran",
        paragraphs: [
          "Harga ditampilkan dalam Rupiah dan sudah termasuk pajak yang berlaku (bila ada). Total dihitung ulang di server saat checkout; harga yang tampil di peramban tidak pernah menjadi dasar transaksi.",
          "Pembayaran diproses oleh gateway pihak ketiga. Kami tidak menerima pembayaran langsung ke rekening pribadi. Pesanan akan kedaluwarsa bila tidak dibayar dalam batas waktu yang tertera.",
        ],
      },
      {
        heading: "4. Upgrade dan pembatasan",
        paragraphs: [
          "Satu pemain hanya dapat memiliki satu rank per season. Upgrade ke tier lebih tinggi dikenakan selisih harga. Pembelian tier lebih rendah dari rank yang sedang aktif ditolak.",
          "Kit dibatasi satu kali per pemain per season, kecuali dinyatakan lain pada halaman produk.",
        ],
      },
      {
        heading: "5. Bila item gagal dikirim",
        paragraphs: [
          "Kalau pembayaran sudah terverifikasi tetapi item belum masuk, kami akan mengirim ulang. Pengiriman ulang adalah satu-satunya solusi dan tidak dianggap sebagai pembatalan pembelian.",
          "Hubungi bantuan dengan nomor order. Kami tidak akan meminta pembayaran kedua dengan alasan apa pun.",
        ],
      },
      {
        heading: "6. Pembayaran ganda dan sengketa",
        paragraphs: [
          "Bila terjadi pembayaran ganda, item tetap dikirim satu kali. Kelebihan pembayaran ditinjau admin dan, bila tervalidasi, dapat diberikan sebagai item tambahan (comp) sesuai kebijakan kami — bukan sebagai refund tunai.",
          "Chargeback atau sengketa dari gateway menyebabkan pesanan ditandai DISPUTED. Kami dapat mencabut item dan membatasi akun bila sengketa terbukti tidak berdasar.",
        ],
      },
      {
        heading: "7. Kontak",
        paragraphs: [
          "Pertanyaan tentang transaksi dikirim ke email bantuan yang tertera di footer. Sertakan nomor order dan username Minecraft agar penanganan lebih cepat.",
        ],
      },
    ],
  },
];

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
