# Protokol penerimaan staging dan keputusan rilis

**Status: belum dijalankan pada server atau gateway nyata.** CI dan mock bukan bukti bahwa integrasi hidup berfungsi. Gunakan lingkungan staging terpisah dengan database, akun, kredensial, plugin, worker, webhook, dan akses Minecraft sendiri; jangan gunakan akun staf atau data pelanggan nyata sebagai fixture. Catat versi/commit, waktu WIB, operator, hasil, dan bukti yang disanitasi untuk setiap skenario. Jangan menyalin secret, token, URL status privat atau data pribadi ke tiket/log publik.

## Persiapan dan penghentian aman

- [ ] Owner menunjuk operator dan menyetujui lingkungan staging. Konfirmasi endpoint staging, akses kontrol, DNS/TLS dan backup terpisah; tidak mengarah ke database, antrean, webhook, RCON, atau Minecraft produksi.
- [ ] Periksa CI pada commit yang akan dirilis; migrasikan database staging kosong, lalu uji migrasi pada salinan backup yang terisolasi. Uji restore backup, termasuk database, konfigurasi dan antrean/marker plugin; verifikasi hasilnya, bukan hanya keberadaan berkas.
- [ ] Sebelum upgrade pada sistem yang sudah berjalan, matikan checkout dan hentikan polling plugin/worker lama sesuai runbook. Simpan inventaris pesanan, pembayaran, delivery, lease/ACK, antrean lokal, `delivery-intents` dan marker selesai. Rekonsiliasi `SENT`, eksekusi parsial, UUID lama, profil dan entitlement satu per satu. Jangan mass-retry, menghapus marker atau menganggap status yang ambigu belum dieksekusi. Tentukan apakah tiap kasus harus ditahan, diperbaiki manual atau di-retry, lalu catat bukti.
- [ ] Cocokkan versi Paper, Java, LoginSecurity, Geyser, Floodgate, LuckPerms dan PlayerKits dengan deployment target; pastikan hanya jalur koneksi yang dipercaya dan tidak ada bypass LoginSecurity/Floodgate. Pasang companion protokol 2 dengan secret staging dan lookup mode `offline`, lalu cek heartbeat. Heartbeat saja bukan bukti seluruh integrasi sehat.

## Matriks Minecraft: Java dan Bedrock

Lakukan setiap kasus menggunakan akun uji sendiri dan UUID yang dilaporkan langsung oleh server/plugin, bukan UUID yang ditebak. Jangan simpan kata sandi LoginSecurity dalam bukti.

- [ ] Java **dan** Bedrock: sebelum `/login`, `/verify` gagal dan tidak ada perintah delivery; salah password atau LoginSecurity tidak tersedia juga fail closed. Setelah `/login`, `/verify` berhasil dan website terhubung ke edisi, nama serta UUID yang benar. Uji logout/reconnect dan pergantian nama sesuai kebijakan server.
- [ ] Masing-masing edisi: bayar melalui gateway sandbox, cocokkan order, webhook, entitlement, polling/lease, ACK dan efek di game untuk rank dan kit. Pastikan target perintah adalah UUID server yang sama; kit benar-benar tersedia di PlayerKits dan cooldown klaim 5 jam berlaku.
- [ ] Pemain offline: pembayaran tercatat tetapi tidak ada eksekusi sebelum login; setelah login, lease baru dapat memproses selama pemain tetap online. Uji restart, logout sebelum eksekusi, lease kadaluarsa, ACK hilang dan kegagalan parsial; catat mana yang perlu rekonsiliasi manual. Jangan menyimpulkan exactly-once hanya dari satu tes.
- [ ] Uji upgrade dan revoke di staging, termasuk akun dengan `freerank`: hanya group rank toko `vip`, `mvp`, `elite`, `legend` berubah; `freerank` dan group lain tetap utuh. Periksa hierarchy, inheritance dan context LuckPerms yang sebenarnya. Uji revoke kit pada transisi season staging tanpa menjadwalkan transisi produksi.

## Staf dan akun alternatif

- [ ] Owner memverifikasi role dan UUID utama serta setiap alternatif yang diketahui di lingkungan target; daftar dimulai kosong dan alternatif yang tidak diketahui tidak bisa terdeteksi otomatis. Uji dengan staf/alternatif khusus staging: pembelian rank oleh staf, oleh alternatif terdaftar, dan hadiah kepada keduanya ditolak sebelum pembayaran.
- [ ] Uji akun berubah menjadi staf atau alternatif terdaftar setelah order dibuat/ketika pemain offline: delivery rank ditahan dan pembayaran direkonsiliasi; jangan menganggap pembatasan menutup semua race atau aksi operator/plugin lain.
- [ ] Periksa group staf LuckPerms dan `freerank` sebelum/sesudah percobaan grant, upgrade dan revoke. Cabut role website staf pada akun uji: akun yang sama kembali `CUSTOMER`, tanpa penggabungan akun; periksa implikasi registry dan antrean.

## Layanan pendukung

- [ ] Dengan kredensial **sandbox** gateway yang benar dan endpoint publik staging, uji setiap metode yang akan ditawarkan: transaksi, callback valid/duplikat, signature rusak, nominal salah, pembayaran terlambat, dibatalkan dan chargeback. Cocokkan status provider, order, entitlement dan delivery; jangan menyimpulkan dari mock semata.
- [ ] Konfigurasikan email staging dan uji verifikasi, reset dan struk ke kotak masuk yang dikendalikan operator; cek SPF/DKIM/DMARC dan spam. Uji Turnstile dan Discord OAuth bila akan digunakan, dengan domain dan callback staging yang benar.
- [ ] Simulasikan pemulihan jaringan, restart worker/plugin dan restore di staging; catat kasus tidak pasti dan cara eskalasi dari `docs/RUNBOOK.md`.

## Gerbang produksi

- [ ] Owner memeriksa checklist `docs/GO_LIVE.md`, backup/restore, antrean lama, hak aset/video (`ASSETS.md`), legal, keamanan, DNS/TLS, kredensial dan konfigurasi. Owner memutuskan kebijakan kuota kupon untuk pembayaran terlambat; jangan membuat atau mengaktifkan promosi otomatis.
- [ ] Owner menyetujui bukti staging dan rencana rollback serta secara eksplisit mengizinkan rilis. Uji transaksi produksi hanya setelah otorisasi dan mengikuti rencana terkontrol; jangan mengaktifkan checkout atau menerapkan migrasi tanpa izin. Bila salah satu gerbang belum lulus: **NO-GO**.
