# Panduan admin CipiSMP Store

Panduan ini untuk staf non-teknis. Semua tombol yang dijelaskan di sini bisa dipakai tanpa
menyentuh database atau kode. Kalau ragu, **berhenti dan tanyakan ke Owner** — beberapa
tindakan tidak bisa dibatalkan.

## Masuk ke panel

1. Buka `https://<domain-toko>/masuk`.
2. Masuk dengan email dan password akun staf.
3. Masukkan 6 digit dari aplikasi authenticator (Google Authenticator, Aegis, 1Password).
   2FA wajib untuk staf dan tidak bisa dimatikan sendiri.
4. Menu di kiri: Ringkasan, Pesanan, Pengiriman, Produk, Season, Pelanggan, Kupon,
   Pembayaran, Server, Staf, Audit log. Menu yang tidak muncul berarti role-mu tidak berhak.

Role:
- **Support** — melihat pesanan/pelanggan, mengirim ulang pengiriman, memberi comp.
- **Admin** — semua di atas + menandai lunas manual, mengubah produk/season/kupon, pengaturan.
- **Owner** — semua + kredensial gateway dan mengubah role staf.

## Halaman Ringkasan

- **Pendapatan hari ini / total** dihitung dari order yang sudah dibayar.
- **Menunggu bayar** = order yang belum dibayar. Tidak perlu ditindak sampai lewat batas waktu.
- **Perlu perhatian** = order gagal + pengiriman gagal permanen. Target harian: 0.
- Kotak season menunjukkan season aktif dan tanggal berakhirnya. Kalau tidak ada season
  aktif, toko tidak bisa menjual — hubungi Owner.
- Di kanan bawah ada **Comp manual**: memberi rank/kit gratis. Selalu isi alasan; alasan
  masuk ke audit log dan tidak bisa dihapus.

## Ringkasan pendapatan

Grafik batang di halaman **Ringkasan** menunjukkan pendapatan per hari (WIB) selama 30 hari
terakhir, hanya dari order yang sudah dibayar. Klik **Lihat angka per hari** untuk melihat
tabel angkanya. Untuk laporan bulanan, gunakan **Ekspor CSV** di halaman Pesanan.

## Menangani pesanan

Buka **Pesanan**, cari dengan nomor order, email, atau nama pemain.

1. **Pesanan normal:** status berubah sendiri dari PENDING → PAID → DELIVERING → DELIVERED.
2. **Tandai lunas manual** — hanya setelah kamu melihat dana masuk di dashboard gateway.
   Tulis alasan yang bisa dicek orang lain, misalnya "Transfer BCA 25.000, ref 88213,
   terverifikasi di dashboard Tripay". Salah menekan tombol ini berarti item terkirim tanpa uang.
3. **Batalkan order** — hanya untuk PENDING/EXPIRED. Order yang sudah dibayar **tidak bisa**
   dibatalkan dan **tidak ada refund**.
4. **Catatan internal** — untuk tim, tidak terlihat pembeli. Pakai untuk mencatat hasil
   pengecekan gateway, nomor tiket, atau keputusan sengketa.

## Kalau item belum masuk

1. Buka detail pesanan → bagian **Pengiriman**.
2. Baca kolom error: biasanya plugin server mati atau RCON salah.
3. Setelah masalah server diperbaiki, tekan **Kirim ulang**.
4. Bila pemain sedang offline, plugin akan mengantre dan mengirim saat pemain login.
   Beri tahu pemain: "rank akan masuk otomatis saat kamu login berikutnya".
5. Kalau sudah 3× gagal, eskalasi ke Admin/Owner; jangan memberi comp sebagai pengganti
   kecuali Owner memutuskan.

Halaman **Pengiriman** menampilkan semua antrean: `Antrean`, `Terkirim`, `Diterima`,
`Gagal (retry)`, `Gagal permanen`. Angka **Gagal permanen** harus 0 setiap hari.

## Produk

**Produk** menampilkan rank dan kit beserta harga, status, dan jumlah terjual.

- Rank awal katalog: **Star Cipi**, **Milk Cipi**, **Pop Cipi**, dan **Cute Cipi**. Harga/keuntungan seed adalah nilai awal dan bisa disesuaikan di dashboard sebelum penjualan.
- Form produk mengatur nama, slug, status, harga, tier/urutan, batas/cooldown, warna badge, ilustrasi lokal, tagline, deskripsi, keuntungan, dan apakah pengiriman perintah server dipakai.
- Untuk rank, atur juga template perintah **grant/revoke**. Placeholder yang tersedia: `{player}`, `{uuid}`, `{season}`, `{rank}`, `{kitname}`. Star/Milk/Pop mempertahankan group LuckPerms lama (`iron`, `gold`, `diamond`); Cute Cipi memakai `cute-cipi` sebagai nilai awal. Pastikan group benar-benar ada di server dan uji pengiriman sebelum produk ditayangkan.
- Untuk kit, isi daftar item satu per baris dengan format `item_key | nama | jumlah | enchantment1,enchantment2 | lore1,lore2`. Kit tayang wajib punya minimal satu item.
- Menambah produk: isi formulir di kanan, simpan sebagai **Draft** dulu, cek tampilan di
  `/rank` atau `/kit`, uji template pengiriman, lalu ubah ke **Published**.
- Menyembunyikan produk: tombol tempat sampah (soft delete). Riwayat order tetap utuh.
  Produk yang dihapus bisa dipulihkan sebagai **Draft** dari baris yang sama.
- Mengubah harga tidak mengubah order yang sudah dibuat. Mengganti slug mengubah URL; cek juga template grant yang mungkin memakai `{rank}`.
- Perubahan **tier** rank harus hati-hati: tier menentukan siapa boleh upgrade ke siapa.

## Season

Season menentukan masa berlaku rank/kit. Tidak ada carry-over dan tidak ada refund saat
season berakhir.

- Season baru biasanya dibuat sebagai **Upcoming** dengan tanggal mulai/selesai (WIB).
- Mengakhiri season **selalu** lewat panel **Transisi season**:
  1. Pilih season, tekan **Pratinjau dampak** → lihat jumlah entitlement dan pemain.
  2. Jalankan **Simulasi** untuk memastikan angka masuk akal.
  3. Pilih **Eksekusi sungguhan**, ketik `AKHIRI SEASON`, isi alasan, kirim.
  4. Buka Ringkasan: season berikutnya harus ACTIVE dan pengiriman REVOKE muncul.
- Jangan mengakhiri season saat sedang ramai pembelian tanpa pengumuman; pembelian
  diblokir otomatis pada *freeze window* (bawaan 3 hari terakhir).

## Kupon

- Tingkat dasar memakai **persen** (1–100) atau **nominal** (minimal Rp 1.000) dan ambang
  minimum belanja. Maksimal dua tingkat tambahan; threshold harus meningkat, dan tier tertinggi
  yang tercapai yang dipakai (diskon tidak dijumlahkan).
- **Season** kosong berarti kupon berlaku lintas-season; pilih season untuk membatasi kupon
  ke season tersebut. Season khusus yang bukan season aktif ditolak saat checkout.
- **Kuota total** 0 berarti tanpa batas; **batas per pembeli** membatasi pemakaian per akun.
- Centang **Hanya rank** atau **Hanya kit** bila kupon tidak boleh dipakai untuk jenis lain.
- Nonaktifkan kupon yang sudah tidak dipakai; jangan menghapusnya karena riwayat pemakaian
  diperlukan untuk pembukuan.

## Pelanggan

- Pencarian berdasarkan email/username.
- Kolom **Total belanja** = jumlah order yang dibayar (bukan termasuk yang gagal/batal).
- **Email terverifikasi** harus "Ya" untuk pembelian dengan akun. Pembeli tamu tetap
  dilayani lewat tautan pesanan publik.
- Akun yang dihapus tetap menyisakan order untuk pembukuan; ini normal.

## Pembayaran

- Gateway menampilkan status aktif, mode (sandbox/live), dan URL webhook.
- Di bagian **Metode yang ditawarkan**, Admin/Owner dapat memilih QRIS, tiap bank Virtual
  Account, dan e-wallet untuk Tripay/Midtrans. Metode yang tidak dicentang tidak muncul di
  checkout; gateway tanpa metode terpilih juga disembunyikan. Simulasi hanya ada di dev.
- **Hanya Owner** yang boleh melihat/mengubah kredensial. Pengaturan metode cukup memakai
  izin `settings.write`, jadi Admin tidak perlu melihat rahasia gateway.
- Daftar **Pembayaran menunggu** menyorot `UNDERPAID` (dana kurang). Verifikasi di dashboard
  gateway: bila pembeli memang kurang bayar, hubungi pembeli lewat email; jangan tandai lunas.
- **Webhook terakhir** menunjukkan apakah signature valid. Banyak `invalid` berarti
  kredensial gateway tidak cocok dengan yang tersimpan.
- **Tidak ada tombol refund.** Jangan menjanjikan pengembalian dana kepada pembeli.

## Server & plugin

- Isi host/port Java dan Bedrock, URL plugin, secret, dan kredensial RCON.
- **Uji plugin** dan **Uji RCON** harus hijau setelah setiap perubahan.
- Mengganti secret plugin harus dilakukan bersama pemilik server Minecraft (nilai yang
  sama di `.env` dan `config.yml`), lalu restart keduanya.
- Panduan pemasangan plugin ada di halaman yang sama.

## Staf

- Menambah staf: minta orang tersebut mendaftar akun biasa, aktifkan 2FA, lalu Owner
  mengubah role-nya di halaman ini.
- Mencabut akses: pilih **Cabut akses** → role menjadi Pelanggan. Riwayat kerjanya tetap
  tercatat di audit log.
- Tidak bisa mengubah role akun sendiri; ini pengaman agar tidak ada yang mengunci dirinya.
- Akun Owner hanya diganti lewat CLI (`npm run seed:owner`) oleh Admin teknis.

## Ekspor data (CSV)

- **Pesanan → Ekspor CSV (100 hari)** mengunduh order 100 hari terakhir: nomor, waktu,
  status, email, pemain, UUID, gateway, rincian uang, kupon, dan catatan admin.
- **Pelanggan → Ekspor CSV** mengunduh daftar akun beserta total belanja dan jumlah order
  yang sudah dibayar.
- Berkas memakai pemisah koma, encoding UTF-8 (aman dibuka di Excel), dan teks yang mirip
  formula otomatis dinetralkan.
- Setiap ekspor tercatat di audit log (`data.export`) beserta jumlah baris dan rentang
  tanggal, dan dibatasi 6 ekspor per menit per akun.
- Data ini berisi informasi pribadi pembeli. Simpan hanya di tempat yang aman dan jangan
  dibagikan ke publik.

## Sesi staf

Di bagian bawah halaman **Staf** ada tabel **Sesi staf aktif**: email, role, perangkat, IP,
waktu aktif terakhir, dan status 2FA sesi.

- **Cabut** pada satu baris mengeluarkan perangkat itu; orangnya harus login ulang + 2FA.
- **Cabut semua sesi** di kolom role mengeluarkan semua perangkat staf tersebut sekaligus —
  pakai bila perangkat hilang atau ada kecurigaan akun diambil alih.
- Sesi milikmu sendiri tidak bisa dicabut dari sini; gunakan **Keluar** atau menu keamanan
  di dashboard.
- Sesi Owner tidak bisa dicabut oleh Admin; hanya Owner sendiri yang bisa.

## Pengaturan toko

Halaman **Pengaturan** (`/admin/pengaturan`) mengatur angka dan saklar yang berlaku langsung
setelah disimpan:

- **Pajak** (persen + label) dan **biaya layanan** (flat / persen / keduanya).
- **Batas waktu bayar** order (menit), **usia minimum** pembeli, dan **freeze season**
  (hari terakhir sebelum pergantian season saat pembelian dikunci).
- **Gateway default** untuk checkout baru (kredensialnya tetap di halaman Pembayaran).
- **Toggle fitur**: kupon, hadiah (gift), ulasan pembeli, login Discord.
- **Identitas situs**: nama situs, tagline, email bantuan (footer/FAQ), URL Discord, dan
  pengumuman banner di atas semua halaman toko (kosongkan untuk menyembunyikan).
- **Pengiriman**: jumlah percobaan maksimal, jeda dasar (naik eksponensial), dan masa tunggu
  sebelum dianggap offline. Setelah percobaan habis, pengiriman menjadi DEAD.

Mematikan sebuah fitur langsung menyembunyikan UI-nya; data lama tidak dihapus. Perubahan
tercatat di audit log (`settings.store`).

## Ulasan pembeli

Ulasan hanya bisa ditulis oleh pembeli produk tersebut (order berstatus lunas/terkirim),
satu ulasan per akun per produk. Semua ulasan baru berstatus **Menunggu**.

- Buka **Ulasan** → tab **Menunggu**. Setiap baris menampilkan produk, rating, isi ulasan,
  penulis, dan nomor pesanan sumber verifikasi.
- **Tampilkan** menerbitkan ulasan ke halaman produk; **Sembunyikan** menariknya kembali
  (mis. berisi kata kasar, data pribadi, atau spam). Bisa dibalik kapan saja.
- Nama penulis otomatis disamarkan (mis. “Budi” dari `Budi_S`) dan ulasan dari pembeli
  terverifikasi diberi label **Pembelian terverifikasi**. Ulasan yang tampil di halaman produk
  juga dikumpulkan di `/ulasan`; feed publik hanya memuat ulasan disetujui pada produk terbit.
- Pemilik ulasan dapat mengeditnya dari `/ulasan` atau halaman produk. Setiap perubahan
  mengembalikan ulasan ke status **Menunggu**, sehingga ulasan tidak tampil lagi sampai disetujui.
- Menolak ulasan tanpa membuka debat: tidak ada fitur balasan publik; tanggapi lewat Discord.

## Login Discord

Login Discord bersifat opsional dan tidak pernah menggabungkan akun otomatis lewat email.

1. Buat aplikasi di <https://discord.com/developers/applications>, ambil Client ID dan
   Client Secret, lalu tambahkan redirect URI `https://<domain>/api/auth/discord/callback`.
2. Isi `DISCORD_CLIENT_ID` dan `DISCORD_CLIENT_SECRET` di `.env`, restart aplikasi.
3. Nyalakan toggle **Login Discord** di `/admin/pengaturan`.

Pemain menautkan akun di **Dashboard → Keamanan**. Staf wajib mengaktifkan 2FA lebih dulu
sebelum bisa menautkan (mencegah tautan Discord menjadi jalan pintas tanpa 2FA). Bila
seseorang menekan tombol Discord tetapi akunnya belum tertaut, sistem mengarahkan mereka
masuk dengan password dulu — bukan membuat akun baru.

## Audit log

Setiap tindakan penting tercatat: siapa (email), apa (aksi), pada apa (order/produk/season),
alasan, dan IP. Gunakan filter untuk mencari, misalnya `season.transition` atau
`order.manual-paid`. Aksi fitur baru juga tercatat: `payments.provider-saved`,
`payments.methods-saved`, `review.submitted`, `review.edited`, `review.approved`,
`review.hidden`, `account.login-discord`, `account.discord-linked`, `account.discord-unlinked`.
Log tidak bisa dihapus dari panel.

## Aturan yang tidak boleh dilanggar

1. **Tidak ada refund** — jangan menjanjikan, memproses, atau mencatat pengembalian dana.
2. **Jangan tandai lunas tanpa bukti** dari dashboard gateway.
3. **Jangan bagikan kredensial** gateway atau secret plugin lewat chat.
4. **Jangan hapus data** (order, produk, entitlement) untuk "membersihkan" tampilan.
5. **Selalu isi alasan** pada comp, pembatalan, dan transisi season.

## Kalau ada masalah

Hubungi Admin/Owner dengan informasi: nomor order, nama pemain, waktu kejadian, dan
tangkapan layar bagian yang bermasalah. Untuk gangguan server (plugin mati, RCON salah),
gunakan `docs/RUNBOOK.md` bagian 2.
