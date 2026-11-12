# Rencana penyelesaian CipiSMP Website & Plugin

**Pembaruan:** 11 November 2026
**Tujuan:** menjadikan website, dashboard, pembayaran, dan plugin Minecraft siap digunakan dengan aman di server CipiSMP.
**Status keseluruhan: belum siap go-live.** Banyak fitur sudah ada, tetapi sejumlah integrasi dan keamanan masih harus diperbaiki atau dibuktikan di lingkungan nyata.

Dokumen ini adalah daftar kerja, bukan pernyataan bahwa semua fitur sudah berjalan di produksi. `[x]` berarti telah dilakukan di lingkungan yang disebutkan; `[ ]` berarti masih harus dikerjakan atau diverifikasi. Hasil uji lokal tidak otomatis membuktikan integrasi dengan layanan eksternal. Catat tanggal, lingkungan, hasil, dan tautan bukti setiap kali mencentang pekerjaan.

## 1. Kondisi saat ini

- [x] Storefront, katalog, keranjang, checkout, dashboard pelanggan, panel admin, pengumuman, kupon, dan diskon otomatis sudah memiliki implementasi. Tidak semua alur telah diuji secara live.
- [x] Profil dan halaman keamanan admin/pelanggan sudah dipisah berdasarkan role, dan logo admin memakai logo CipiSMP seperti landing page. Pengujian langsung dengan sesi akun terpisah menunjukkan staf dialihkan dari dashboard pelanggan dan pelanggan ditolak dari panel admin.
- [x] Source plugin **CipiStoreCompanion** tersedia di `plugin/`, termasuk `/verify <kode>`, polling pengiriman dan antrean offline. Website juga memiliki endpoint `/api/plugin/verify`.
- [x] Pada pemeriksaan terakhir: build produksi, typecheck, 125 tes unit, dan 41 tes integrasi lulus; migrasi sampai `0010` berhasil pada database uji sementara. Hasil ini bukan pengujian transaksi dan server Minecraft nyata.
- [ ] Plugin **belum dibangun dan diuji di sandbox sesi ini**: JDK 21 dan Gradle tidak tersedia. Workflow CI menyiapkan build dan upload JAR, tetapi status run/artifact terbaru belum diverifikasi untuk perubahan saat ini. Belum ada JAR terverifikasi dari sesi ini.
- [ ] Login di browser embedded Arena masih dapat berulang meminta login. Preview saat ini memakai proxy demo terisolasi yang menyuntikkan sesi; itu **bukan** perbaikan autentikasi dan **bukan** bukti bahwa login sebenarnya sudah berfungsi.
- [ ] Payment gateway, email, Discord OAuth, Turnstile, Paper/Floodgate, LuckPerms, PlayerKits, dan RCON belum terverifikasi end-to-end dengan layanan/server aktual untuk perubahan saat ini.
- [ ] Perubahan terbaru di working tree belum semuanya tercatat dalam commit; database produksi tidak diubah pada pekerjaan ini. Dokumentasi lama dapat berisi status yang lebih lama dan perlu diselaraskan.

## 2. Ketentuan yang harus dipertahankan

1. Rank termurah **Cute Cipi** Rp10.000 (`vip`), lalu **Pop Cipi** Rp30.000 (`mvp`), **Milk Cipi** Rp60.000 (`elite`), dan termahal **Star Cipi** Rp100.000 (`legend`). Jangan membalik urutannya.
2. Season 1 tetap berjalan; akhir yang disetujui **14 Januari 2027 pukul 00.00 WIB** (`2027-01-13T17:00:00Z`). Jangan jalankan transisi season sekarang. Rentang seed 14 November–14 Januari adalah dua bulan kalender / 61 hari, jadi hindari klaim persis 60 hari tanpa persetujuan.
3. Kupon tetap tersedia bersama diskon otomatis; saat keduanya berlaku, pilih penghematan terbesar dan kupon menang jika sama. Tidak ditumpuk.
4. Dashboard, profil, dan akses admin serta pelanggan harus terpisah. Data perubahan profil harus tetap milik akun yang sedang login; switching role/akun tidak boleh menggabungkan identitas otomatis.
5. Footer menggunakan teks persis **“All rights reserved.”** Disclaimer non-afiliasi ada di Syarat Layanan, email transaksi, dan invoice, bukan di footer.
6. Panduan join Java/Bedrock tetap animatif dan rapi; galeri gameplay tetap natural dan berkarakter. Pertahankan UI responsif, menu/daftar yang dapat di-scroll, dan tampilan profesional tanpa mengulang desain yang sudah disetujui.
7. Jangan menjalankan transaksi, migrasi produksi, perubahan season, pembelian, atau aksi pada server nyata tanpa izin dan backup yang sesuai.

## 3. Urutan prioritas dan gerbang

| Tahap | Prioritas | Hasil wajib sebelum lanjut |
| --- | --- | --- |
| A | P0 | Login/sesi nyata berfungsi dan batas akses admin/pelanggan diuji tanpa proxy demo. |
| B | P0 | Verifikasi Minecraft aman dan benar untuk Java serta Bedrock; plugin berhasil build dan diuji. |
| C | P0 | Transaksi, diskon, pengiriman, email, dan pemulihan terbukti di staging. |
| D | P1 | Uji keamanan, regresi visual, aksesibilitas, performa, dan kesiapan operasional selesai. |
| E | P0 untuk rilis | Migrasi aman, konfigurasi produksi, backup/restore, legal, monitoring, dan persetujuan owner lengkap. |

Pekerjaan yang tidak memerlukan dependensi boleh dikerjakan paralel. Yang ditandai P0 memblokir go-live; P1 perlu diselesaikan sebelum rilis atau secara eksplisit disetujui owner dengan mitigasi.

## 4. A — Akun, login, keamanan dan dashboard (P0)

- [ ] Reproduksi masalah login berulang pada browser/embedded preview pengguna yang sebenarnya: rekam alur login → navigasi client → refresh → tab baru → logout. Periksa atribut cookie, origin, proxy, kebijakan third-party storage/browser dan respons middleware **tanpa mencatat token atau password**.
- [ ] Tentukan penyebab yang terbukti; perbaiki dengan mekanisme yang aman dan sesuai lingkungan. Jangan mengandalkan proxy yang menyuntikkan sesi, jangan melemahkan cookie/CSP produksi hanya agar demo bekerja, dan jangan menyimpan token sesi di URL atau log.
- [ ] Uji login normal di browser desktop/mobile dan di preview embedded yang dimaksud. Jika platform membatasi cookie sehingga tidak bisa diperbaiki oleh aplikasi, dokumentasikan batasannya dan sediakan jalur demo yang diberi label jelas, bukan menganggap login normal lulus.
- [ ] Uji akun pelanggan dan akun staf yang benar-benar berbeda: login, refresh, logout, pergantian akun, akses langsung URL, server action, dan sesi kedaluwarsa/dicabut. Pelanggan tidak masuk `/admin/*`; staf tidak memakai `/dashboard/*`; tanpa sesi diarahkan login.
- [ ] Uji perubahan nama/username, email, password, Discord, sesi dan 2FA pada masing-masing akun; data akun lain tidak berubah. Periksa redirect login/MFA/Discord/email change menuju area sesuai role, termasuk redirect aman dan tujuan checkout.
- [x] Keputusan owner: saat akses staf dicabut, akun staf yang sama boleh dikonversi menjadi `CUSTOMER`; tidak perlu membuat akun pemain baru untuk konversi tersebut. Ini tidak berarti menggabungkan dua akun yang sudah terpisah.
- [ ] Uji konversi role pada staging: hak admin harus hilang, dashboard pemain tersedia sesuai role, riwayat akun tetap utuh, dan perilaku sesi/audit aman. Perubahan role saat ini tidak otomatis mencabut semua sesi; tentukan dan uji kebutuhan pencabutan sesi. Jangan mengubah akun nyata tanpa persetujuan dan rencana.
- [ ] Tinjau dan uji enforce 2FA staf pada seluruh jalur masuk (password dan Discord), setup awal, anti-replay, penguncian, revoke sesi dan pemulihan. Pastikan akses admin tidak dapat dilompati via URL/API/action.
- [ ] Uji CSRF/Origin, validasi input, rate limit lintas instance, isolasi data, otorisasi setiap route/action admin, audit log, keamanan cookie produksi, serta pesan error yang tidak membocorkan identitas.
- [ ] Regresi layout: logo sama dengan landing; navigasi aktif, profil, keamanan, daftar panjang, scroll keyboard, 360/375/768/1280/1536 px, tanpa overflow horizontal; cek focus dan screen reader.

**Selesai bila:** tes otomatis dan manual menunjukkan dua akun independen mempertahankan akses dan profilnya masing-masing, serta masalah login asli telah teratasi atau batasan platform telah dibuktikan dan disetujui untuk jalur penggunaan yang relevan.

## 5. B — Plugin Minecraft dan verifikasi in-game (P0)

### B1. Perbaikan dan keamanan verifikasi

- [ ] Audit dan perbaiki alur kode: dashboard membuat kode satu kali (masa berlaku saat ini 15 menit), plugin menerima `/verify <kode>`, website mengonfirmasi identitas pemain dan menautkan akun yang tepat.
- [ ] **Investigasi/perbaiki Bedrock sebelum menyatakan dukungan siap:** `resolvePlayer` membuat UUID placeholder deterministik untuk Bedrock, sedangkan endpoint membandingkan UUID token dengan UUID aktual dari plugin. Keduanya dapat berbeda sehingga verifikasi ditolak; jangan sekadar menghapus perbandingan tanpa pengganti yang aman. Rancang pengikatan identitas dan transisi placeholder → UUID Floodgate sebenarnya tanpa memungkinkan klaim akun lain atau kehilangan entitlement/order.
- [ ] Verifikasi deteksi edisi Java/Bedrock terhadap konfigurasi server aktual: kode plugin saat ini memakai heuristik versi UUID, bukan pembuktian integrasi Floodgate. Tentukan penanganan prefix nama dan UUID yang konsisten dengan Floodgate server.
- [ ] Audit pengikatan profil dan race condition: kode kedaluwarsa/sudah digunakan, dua request bersamaan, dua akun mencoba menghubungkan UUID yang sama, perubahan kepemilikan, unlink/relink, gagal database/timeout, serta pemakaian ulang token. Konsumsi token dan perubahan profil harus atomik; pemilik yang sudah terverifikasi tidak boleh ditimpa oleh akun lain.
- [ ] Uji Java online-mode dengan UUID Mojang, Bedrock via Geyser/Floodgate, nama salah, kode salah/kedaluwarsa, pemain berbeda, replay, HMAC/nonce/timestamp salah, dan plugin tidak terhubung. Pastikan identitas server memang terpercaya; tentukan kebijakan bila server memakai offline-mode.
- [ ] Tambahkan unit/integration test untuk seluruh kasus di atas, termasuk konkurensi dan migrasi identitas Bedrock. Verifikasi bahwa halaman dashboard menampilkan hasil yang benar tanpa menghapus data pemain lain.

### B2. Build dan distribusi plugin

- [ ] Siapkan JDK 21 dan Gradle 8.10.x pada runner yang dapat mengakses dependency Paper/LuckPerms; pertimbangkan Gradle Wrapper yang dipin dan diverifikasi checksum agar build dapat diulang.
- [ ] Jalankan `cd plugin && gradle test build`; perbaiki error kompilasi/dependency maupun test, jangan menganggap source sebagai JAR yang siap pakai.
- [ ] Cek CI job `plugin` untuk commit yang benar; verifikasi artifact JAR, nama file sebenarnya, isi `plugin.yml` dan `config.yml`, versi API/Paper, checksum SHA-256 dan hasil test. Simpan/terbitkan JAR melalui artifact/release yang disetujui, bukan hasil build besar dalam Git.
- [ ] Dokumentasikan kompatibilitas versi Paper/Java, dependensi opsional LuckPerms dan kebutuhan Geyser/Floodgate untuk Bedrock; tulis langkah instalasi, update, rollback, backup konfigurasi dan troubleshooting. Jangan menjanjikan kompatibilitas versi lain sebelum diuji.
- [ ] Pasang JAR **di server staging**, atur `website-url` HTTPS dan `shared-secret` yang sama dengan `PLUGIN_SHARED_SECRET` pada web staging; restart plugin/server, cek log serta heartbeat `/admin/server`. Jangan membagikan secret di chat atau commit.
- [ ] Uji command `/verify` dan alias, respons sukses/gagal, thread server tetap responsif, timeout, DNS/TLS, secret salah, clock drift, plugin restart dan server reboot.

### B3. Pengiriman rank/kit

- [ ] Uji webhook pembayaran → antrean → polling HMAC/nonce → ACK → perintah tepat satu kali, termasuk retry, lease kedaluwarsa, ACK hilang, request ganda, restart plugin/web/worker dan kegagalan tulis disk.
- [ ] Tambahkan tes antrean offline, termasuk kegagalan penulisan marker selesai dan pemulihan saat pemain login; pastikan tidak ada kehilangan atau eksekusi ganda yang tidak terdeteksi.
- [ ] Di staging, uji pemain online/offline, queue penuh, upgrade rank, comp, revoke melalui plugin serta RCON untuk kit yang diizinkan. Verifikasi perintah rank `parent add/remove`, template lama/kustom dan hierarchy tidak menghapus group lain, terutama group staf; sepakati penanganannya dengan owner.
- [ ] Uji permission `playerkits.kits.cipiprime` dan `playerkits.kits.cipi++`, klaim isi kit, cooldown **5 jam** di PlayerKits, limit satu pembelian per pemain per season, dan revoke keduanya pada simulasi akhir season staging.
- [ ] Uji akhir season **hanya pada staging**; pastikan perintah revoke benar-benar diterapkan di game, bukan sekadar status database berubah.

**Selesai bila:** tersedia JAR yang dapat diunduh beserta checksum dan hasil build/test; Java dan Bedrock berhasil memverifikasi serta menerima rank/kit pada server staging, termasuk kasus gagal/retry yang aman.

## 6. C — Checkout, pembayaran, diskon, email, dan integrasi (P0)

- [ ] Uji katalog, harga, benefit, stok/ketersediaan, keranjang, hadiah, batas satu rank, upgrade/selisih dan larangan downgrade pada akun uji; total harus dihitung ulang di server.
- [ ] Uji kupon dan diskon otomatis: aktif/nonaktif, jadwal, season/rank/kit/minimum, kuota, kupon invalid, ambang bertingkat, nilai seri, pembulatan, dan kondisi bersamaan. Pastikan tidak stacking dan harga tidak negatif. Bandingkan total checkout, payment gateway, database, detail pesanan, invoice, email dan ekspor.
- [ ] Uji CRUD/toggle diskon dan kupon, pengumuman, serta izin & audit admin. Perubahan admin tidak boleh mengubah nominal order historis yang telah dibuat.
- [ ] Konfigurasi gateway sandbox yang dipilih owner; uji tiap metode aktif dengan transaksi test, callback sah/salah/ganda/telat, nominal kurang/lebih, expired, pembatalan dan chargeback. Cocokkan order, payment, entitlement, pengiriman dan invoice; lakukan satu uji nominal kecil live **hanya dengan persetujuan owner** setelah staging lulus.
- [ ] Konfigurasi email provider staging; uji verifikasi email, reset password, perubahan email, order, pembayaran dan invoice ke inbox nyata, SPF/DKIM/DMARC, tautan dan disclaimer. Outbox/mock bukan bukti email terkirim.
- [ ] Jika dipakai, uji Discord OAuth dengan aplikasi/redirect URI yang benar untuk admin dan pelanggan, termasuk tautkan/lepas akun dan MFA. Jika tidak dipakai, pastikan toggle nonaktif dan UI sesuai.
- [ ] Uji Turnstile di domain staging jika dipakai: token sah, invalid, kedaluwarsa dan kegagalan jaringan; sesuaikan CSP dengan integrasi yang benar. Uji lookup Mojang/Bedrock aktual dan status server; siapkan perilaku saat layanan eksternal gagal.
- [ ] Uji tampilan invoice PDF, URL pesanan bertoken, status/riwayat, review dimoderasi, gifting dan notifikasi staf, termasuk data sensitif tidak terekspos ke role yang tidak berhak.

**Selesai bila:** seluruh alur sandbox yang relevan punya bukti dan satu transaksi live yang disetujui dapat ditelusuri dari pembayaran sampai hak diterima, tanpa pengiriman ganda.

## 7. D — Kualitas, keamanan, dan regresi (P1; keamanan kritis P0)

- [ ] Jalankan ulang `npm run typecheck`, `npm run test:unit`, migrasi lalu `npm run test:integration` dengan **database test disposable**, `npm run build`, dan `git diff --check` untuk perubahan final. Pastikan integrasi tidak ter-skip karena `TEST_DATABASE_URL` kosong.
- [ ] Jalankan `npm run test:e2e` dengan browser Playwright di runner yang sesuai; tambah skenario login/logout, pemisahan role, pengaturan profil, kupon/diskon, checkout, serta verifikasi Minecraft yang bisa disimulasikan. Browser harness preview terisolasi tidak menggantikan E2E login riil.
- [ ] Jalankan CI terbaru pada commit final: quality, e2e, plugin, dan Docker; periksa hasil setiap job dan artifact, jangan hanya mengandalkan konfigurasi workflow atau laporan historis.
- [ ] Validasi `docker compose config`, build image dan smoke test web/worker/migrate di runner dengan Docker; uji restart dan health check. Jalankan beban k6 pada staging dengan batas aman dan data uji, lalu evaluasi bottleneck.
- [ ] Review OWASP: kontrol akses IDOR, session fixation, XSS, CSRF, open redirect, rate limiting, validasi webhook mentah, keamanan token, HTTP headers, CSP, dependensi, secret dan log sensitif. Uji satu instance maupun multi-instance bila digunakan.
- [ ] Lighthouse mobile/desktop untuk beranda dan produk; uji keyboard, label, kontras, `prefers-reduced-motion`, navigasi dan list scroll, empty/loading/error states, mobile dan layar besar. Target awal Lighthouse ≥90 untuk kategori yang relevan; catat kendala yang realistis.
- [ ] Regresi visual: galeri natural, animasi join guide, logo, urutan rank, season/countdown, footer/disclaimer, harga dan diskon di seluruh halaman termasuk email/invoice.
- [ ] Rapikan dokumentasi lama (`README.md`, `docs/PROGRESS.md`, `docs/GO_LIVE.md`, `docs/RUNBOOK.md`, `docs/ADMIN_GUIDE.md`): cantumkan migrasi `0010`, halaman profil/keamanan admin yang baru, status build plugin dan hasil tes aktual; perbaiki instruksi lama yang menunjuk dashboard pelanggan untuk keamanan owner.

## 8. E — Infrastruktur, data, keamanan operasional dan rilis (P0)

### Sebelum deploy

- [ ] Pilih hosting/domain HTTPS, DNS, reverse proxy, sertifikat/TLS, jaringan private untuk PostgreSQL/Redis, kapasitas, sinkronisasi waktu NTP dan zona waktu WIB. Pastikan hosting Minecraft dapat mengakses HTTPS website keluar.
- [ ] Siapkan lingkungan **staging dan produksi terpisah** dengan database, akun, secret dan provider masing-masing. Isi variabel yang relevan dari `.env.example`; kelola secret di secret manager dan jangan tempel nilainya di issue/chat/repo.
- [ ] Konfirmasi `APP_URL`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `PLUGIN_SHARED_SECRET`, `CRON_SECRET`, provider email/pembayaran, owner, worker, Turnstile/Discord bila dipakai. Lindungi dan backup kunci enkripsi; rotasinya memerlukan prosedur re-enkripsi, bukan sekadar mengganti nilai.
- [ ] Backup database dan file/config plugin; uji restore di lingkungan terpisah. Buat prosedur rollback aplikasi/plugin dan mitigasi migrasi yang tidak reversibel; jangan menjalankan `db:seed` sembarangan pada data nyata.
- [ ] Bandingkan journal/schema/data database yang ada dengan migrasi `0000`–`0010` pada salinan backup. Review migrasi produk, katalog, plugin dan diskon beserta dampak terhadap pelanggan/entitlement; selesaikan drift sebelum migrasi. Jangan mengubah season aktif atau menjalankan transisinya.
- [ ] Uji deploy staging dari awal: migrasi, web, worker, cron, plugin, backup/restore, retry/restart, alert, serta rollback. Verifikasi hanya satu season aktif dan tanggal yang benar.
- [ ] Owner meninjau katalog, syarat dan privasi (termasuk aturan penjualan/refund sesuai hukum setempat), disclaimer serta hak penggunaan komersial logo, sprite, video dan screenshot. Jika hak tidak jelas, ganti aset dengan yang izinnya jelas sebelum go-live; catat di `ASSETS.md`.
- [ ] Aktifkan monitoring uptime/health, antrean worker dan delivery, webhook, email gagal, ruang disk, TLS dan backup; kirim alert ke kanal yang benar. Tetapkan penanggung jawab, akses darurat, retensi log/data, dan prosedur insiden.

### Hari rilis — hanya setelah persetujuan owner

- [ ] Bekukan versi/commit, pastikan CI hijau dan hasil staging dicatat; tentukan jadwal, penanggung jawab serta rencana rollback.
- [ ] Ambil dan verifikasi backup terbaru; terapkan migrasi yang telah direview, deploy web/worker dan JAR yang terverifikasi, konfigurasi secret dengan aman, cek health/heartbeat.
- [ ] Periksa katalog, season, halaman legal, akses admin/customer, checkout, gateway/webhook, email dan pengiriman. Lakukan smoke test live nominal kecil jika telah disetujui owner dan rekonsiliasi hasilnya.
- [ ] Monitor setelah rilis, catat error/insiden, cek backup dan antrean; owner menyatakan go/no-go. Bila gerbang P0 gagal, hentikan rilis atau rollback sesuai prosedur.

## 9. Keputusan / informasi yang dibutuhkan dari owner

- [ ] URL/domain staging dan produksi, platform hosting web serta server Minecraft, versi Paper/Java, setup Geyser/Floodgate/LuckPerms/PlayerKits dan akses staging yang aman.
- [ ] Pilihan gateway/metode pembayaran, provider email, penggunaan Discord OAuth dan Turnstile; akses hanya lewat konfigurasi aman, **bukan dikirim sebagai rahasia di chat**.
- [x] Kebijakan akun staf saat akses dicabut: owner memilih konversi akun yang sama menjadi pelanggan; pengujian role dan sesi tetap diperlukan sebelum rilis.
- [x] Owner memutuskan staf tidak boleh membeli rank, termasuk memakai akun pemain lain, atau menerima rank sebagai hadiah; grup staf harus dipertahankan. Implementasi dan metode identifikasi staf yang tepercaya masih perlu dirancang dan diuji.
- [ ] Persetujuan teks legal, hak aset, rencana backup/retensi, penanggung jawab operasional, jadwal rilis dan pengujian live nominal kecil.

## 10. Definisi selesai dan pelacakan

Website dinyatakan selesai/siap rilis setelah semua P0 terpenuhi, pekerjaan P1 dituntaskan atau diterima owner dengan mitigasi, serta ada bukti build/test plugin dan hasil staging nyata. Tandai pekerjaan selesai hanya setelah diverifikasi; tulis hasil di bawah atau tautkan ke run CI, laporan staging, dan checklist rilis tanpa memuat rahasia atau data pribadi.

| Tanggal | Lingkungan / versi | Pekerjaan | Hasil & bukti | Penanggung jawab |
| --- | --- | --- | --- | --- |
| 11 Nov 2026 | Sandbox, working tree sesi saat itu | Build/typecheck + unit/integrasi; guard akun berbeda | Lulus: 125 unit, 41 integrasi; plugin build dan integrasi nyata belum diverifikasi | Tim pengembangan |

**Dokumen pendukung:** [`README.md`](README.md), [`docs/GO_LIVE.md`](docs/GO_LIVE.md), [`docs/PROGRESS.md`](docs/PROGRESS.md), [`docs/RUNBOOK.md`](docs/RUNBOOK.md), [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md), [`ASSETS.md`](ASSETS.md). Jika ada perbedaan status historis, verifikasi ulang pada versi yang akan dirilis dan perbarui dokumen terkait.

## 11. Temuan audit tambahan — 11 November 2026

Temuan awal berikut disimpan sebagai riwayat audit. Sebagian sudah diperbaiki dalam working tree; status terkini dan batasannya tercatat pada bagian 12. Item belum dicentang sampai kriteria pengujian lengkapnya terpenuhi.

### P0 — blokir produksi

- [ ] **2FA bisa dilewati setelah password benar (direproduksi pada backend dengan akun dan sesi uji terisolasi).** Sesi dengan `totp_enabled_at` aktif dan `mfa_satisfied_at` kosong tetap mendapat HTTP 200 di `/admin/profil`: `getViewer`/`requireStaff` tidak memeriksa status MFA (`src/server/auth/guard.ts`, `src/app/actions/auth.ts`). Terapkan sesi parsial yang hanya bisa mengakses alur MFA/logout sampai verifikasi selesai, termasuk semua API/action, OAuth, checkout dan akses langsung; tangani bootstrap 2FA staf secara aman. Tambah uji bypass, replay, lockout, session rotation dan role promotion. Jangan uji dengan akun nyata.
- [ ] **Identitas dan delivery Bedrock (ditemukan lewat kode; uji di Floodgate nyata masih dibutuhkan).** `resolvePlayer` memakai UUID placeholder (`src/server/minecraft.ts`), tetapi `/api/plugin/verify` membandingkannya dengan UUID pemain server. Checkout juga menggunakan UUID hasil resolusi tersebut untuk entitlement/delivery (`src/server/orders.ts`), sehingga delivery plugin dapat tidak cocok dengan UUID asli dan tetap antre. Rancang identitas Floodgate yang aman dan konsisten untuk verifikasi, pembelian, hadiah, riwayat, dan pengiriman; jangan sekadar melewati pemeriksaan UUID.
- [ ] **Pembatasan pembelian kit tidak mempertimbangkan jumlah pada baris (direproduksi pada mesin harga).** `priceCart` menerima quantity 2 dengan `maxPerSeason=1` dan menghasilkan total dua unit tanpa error (`src/lib/pricing.ts`); cart dapat menaikkan quantity dengan menambahkan produk lagi, tetapi fulfillment membuat satu entitlement dan satu delivery per baris. Pembeli berisiko membayar lebih dari hasil yang diberikan. Tegakkan batas jumlah server-side, uji cart dan checkout termasuk request paralel, serta rekonsiliasi pembayaran tanpa mengubah data produksi sembarangan.
- [ ] **Profil Minecraft bisa terkunci sebelum terbukti milik pemain; token dan ownership tidak atomik (analisis kode).** Pembuatan kode langsung menyetel `userId` profil (`src/app/actions/account.ts`), termasuk profil yang belum diverifikasi, sehingga pihak lain dapat terhalang selama profil tertaut. Endpoint verifikasi membaca token sebelum transaksi dan mengubah kepemilikan tanpa pemeriksaan ulang atomik (`src/app/api/plugin/verify/route.ts`); uji dan perbaiki persaingan claim, kepemilikan terverifikasi, token single-use, rollback dan cleanup token/profil pending.
- [ ] **Antrean plugin dapat hilang saat proses berhenti (analisis kode).** `QueueStore.drain` menghapus dan menyimpan antrean sebelum `flushQueued` menjalankan perintah (`plugin/src/main/java/id/cipismp/companion/QueueStore.java`, `DeliveryService.java`); crash di antara langkah tersebut berisiko kehilangan pengiriman yang sebelumnya sudah di-ACK. Rancang pemulihan persisten dan uji crash/failure sebelum dan setelah setiap langkah, termasuk perintah sebagian berhasil. Jangan klaim exactly-once tanpa batasan teknis dan bukti.

### P1 — gangguan fungsi / keamanan

- [ ] **Turnstile jika diaktifkan membuat pendaftaran normal gagal (analisis kode).** Server menuntut token ketika `TURNSTILE_ENABLED=1`, tetapi form daftar tidak memasang widget/input token (`src/components/store/auth-forms.tsx`, `src/server/auth/turnstile.ts`), dan CSP belum menyediakan resource Turnstile. Implementasikan widget dan CSP yang tepat; uji di domain staging dengan token valid/invalid. Sampai itu selesai jangan aktifkan fitur di produksi.
- [ ] **Rate limit login dan tambah keranjang memakai bucket bersama, bukan per-IP/per-pengguna (analisis kode).** `guardMutation` memakai key literal seperti `login:ip` tanpa memasukkan IP; cart memakai key per produk (`src/app/actions/auth.ts`, `src/app/actions/cart.ts`). Banyak pengunjung bisa saling memblokir. Gunakan identitas/penentuan IP trusted proxy yang benar dan uji beberapa pengguna, NAT, Redis dan fallback.
- [ ] **Verifikasi email tidak ditegakkan pada checkout akun (analisis kode).** UI verifikasi mengatakan email harus diverifikasi untuk checkout dengan akun, tetapi `checkoutAction` memakai `getViewer` tanpa memeriksa `emailVerifiedAt` dan tetap menautkan order ke user. Tegaskan kebijakan: tolak checkout akun belum verifikasi atau tawarkan checkout tamu yang benar-benar tidak tertaut; uji keduanya.
- [ ] **Pemisahan akun belum absolut di manajemen staf.** Owner dapat mengubah role record yang sama antara staf dan pelanggan (`adminSetRoleAction`); sepakati kebijakan akun terpisah lalu desain pencabutan akses/provisioning tanpa memindahkan data diam-diam.
- [ ] **Batas kupon dan pembelian bersamaan perlu diuji lebih jauh.** Harga/kuota dibaca sebelum order dibuat, sedangkan pemakaian kupon dicatat saat pembayaran; beberapa order pending bisa melewati batas sebelum dibayar (`src/server/orders.ts`). Uji paralel dan pilih strategi reservasi/kedaluwarsa yang tetap menghormati pembayaran terlambat.
- [ ] **Diskon khusus kategori pada keranjang campuran perlu keputusan bisnis.** Validasi hanya mengecek keberadaan jenis barang, lalu potongan dihitung pada seluruh subtotal (`src/lib/pricing.ts`); pastikan apakah rank-only/kit-only memang boleh memotong kategori lain. Sesuaikan perhitungan dan tes jika tidak.
- [ ] Masalah login preview tertanam masih belum teratasi; JAR plugin, gateway, email, Discord dan server Minecraft nyata masih belum terverifikasi. Lihat tahap A–E di atas.

**Hasil audit sesi ini:** typecheck dan 125 tes unit lulus, tetapi tes yang ada tidak mencakup semua kasus di atas. Uji MFA menggunakan sesi sementara pada database preview terisolasi yang dibersihkan setelah pengujian; uji quantity menggunakan fungsi murni tanpa transaksi. Tidak ada tes produksi atau pembayaran nyata.


## 12. Perbaikan dan batasan working tree — 11 November 2026

- MFA parsial diblokir pada viewer dan kontrol akses staf; enrollment awal staf dibatasi pada halaman keamanan dan action setup, verifikasi kode anti-replay atomik, serta rotasi sesi. Tes guard lulus; uji login dan enrollment nyata end-to-end, role promotion, lockout dan OAuth masih diperlukan.
- Checkout akun mewajibkan email terverifikasi; token verifikasi/perubahan email divalidasi dan dikonsumsi secara atomik. Pengujian integrasi mencakup token lama dan replay bersamaan.
- Quantity kit dipaksa satu di cart dan ditolak pada mesin harga; perlu uji pembelian paralel menyeluruh. Identitas Bedrock kini dikonfirmasi oleh plugin dan menggunakan UUID aktual yang sudah terverifikasi; ownership/token diproses secara atomik. Server Floodgate nyata dan hadiah lintas akun belum dibuktikan.
- Widget Turnstile dan CSP telah ditambahkan; uji domain nyata, proxy tepercaya dan rate limit lintas instance masih wajib.
- Reservasi kupon untuk order pending belum kedaluwarsa diserialisasi dengan lock dan mencakup redemption serta batas per pembeli. **Risiko tersisa:** webhook/reconciliation masih dapat memenuhi order EXPIRED yang dibayar terlambat setelah slot dipakai order lain, sehingga kuota bisa terlampaui. Jangan mengandalkan kuota sebagai batas absolut sebelum memilih dan menguji kebijakan rekonsiliasi/refund/penanganan manual bersama gateway. Penggantian kode kupon ketika order masih pending juga perlu penanganan kebijakan dan pengujian.
- Syarat rank/kit saat ini memeriksa keberadaan kategori, tetapi diskon dihitung dari seluruh subtotal campuran. Ini sekarang dijelaskan pada form admin; keputusan owner diperlukan bila potongan harus hanya mencakup item kategori itu. Kupon dan promo otomatis tidak ditumpuk; potongan lebih besar dipilih, kupon menang saat seri.
- Antrean plugin tidak lagi dikuras sebelum perintah dijalankan dan menyimpan lewat file sementara; kegagalan parsial atau crash setelah perintah tetapi sebelum marker masih dapat menyebabkan duplikasi. Exactly-once, build Java, dan uji crash belum terbukti.
- Dashboard pemain menampilkan langkah berikutnya yang kontekstual. Akun admin/pelanggan memiliki dashboard terpisah; perubahan role pada record yang sama masih mungkin dan memerlukan kebijakan provisioning owner.
- Pengujian sandbox: migrasi `0000`–`0010` pada PostgreSQL disposable, 129 unit dan 50 integrasi lulus; production build dan typecheck lulus; jalankan ulang untuk commit rilis. Preview terisolasi menggunakan sesi demo yang disuntik, bukan bukti login produksi. CI/artifact rilis dan provider eksternal belum diperiksa.

**Prioritas rekomendasi dashboard:** (1) status verifikasi Minecraft dan instruksi perbaikan yang diperbarui setelah `/verify`; (2) pelacakan pembayaran dan pengiriman per pesanan dengan alasan kegagalan serta kanal bantuan; (3) status rank/kit, masa berlaku season dan cooldown berdasarkan data server yang benar-benar tersinkron; (4) notifikasi in-app/email yang dapat diatur pengguna. Jangan menampilkan status server sebagai fakta live sebelum integrasinya teruji.

Uji bootstrap HTTP pada backend demo terisolasi: staf tanpa TOTP diarahkan melalui redirect streaming dari `/admin` dan `/admin/profil` ke `/admin/keamanan`, halaman hanya menampilkan enrollment, dan ekspor ditolak 403. Pengujian integrasi mengonfirmasi setup dan anti-replay TOTP bersamaan; alur browser/login nyata masih perlu diuji. Audit UI 375 px menemukan overflow Season yang telah diperbaiki dan diperiksa ulang; harness navigasi ulang desktop terhenti pada satu halaman, jadi bukan bukti regresi penuh.


## 13. Dashboard pemain — 11 November 2026

- [x] Detail pesanan menampilkan status pembayaran/pengiriman per item, pesan bantuan aman (tanpa error/perintah internal) dan kontak bantuan. Status yang ditampilkan adalah catatan toko, bukan bukti item ada di inventaris game.
- [x] Halaman rank & kit menggunakan hak untuk profil Minecraft terverifikasi, masa berlaku season dan riwayat. Aturan klaim kit ditampilkan, tetapi sisa cooldown dan status inventaris tidak tersedia tanpa sinkronisasi PlayerKits.
- [x] Preferensi ringkasan pesanan di dashboard dan email tambahan saat pengiriman selesai disimpan per akun. Konfirmasi order/pembayaran dan email keamanan tetap wajib; perubahan tidak membatalkan email yang sudah masuk outbox. Tampilan pembaruan adalah status terkini lima order, bukan inbox real-time atau riwayat peristiwa.
- [x] Migrasi baru `0011_yielding_mac_gargan.sql` diterapkan pada database disposable dan preview terisolasi, bukan produksi. 130 unit dan 52 integrasi lulus. Pengujian browser 375 px memeriksa halaman baru, penyimpanan preferensi setelah reload, serta detail pengiriman gagal tanpa membocorkan error internal.
- [ ] Uji end-to-end provider email dan gateway di staging, otorisasi lintas akun lewat browser/login riil, sinkronisasi server Minecraft/Floodgate/PlayerKits, dan cooldown aktual. Sebelum produksi terapkan seluruh migrasi yang diperlukan setelah backup dan uji restore.

## 14. Hardening lanjutan pembayaran, pengiriman dan notifikasi — 11 November 2026

- [x] Webhook memeriksa kecocokan order/provider/referensi pembayaran; nominal kosong/tidak valid tidak dianggap lunas. Rekonsiliasi memeriksa nominal dan mengikutsertakan pembayaran expired. Order dibatalkan yang menerima pembayaran ditandai untuk peninjauan tanpa mengirim barang otomatis. Perlu uji kontrak gateway nyata, khususnya perbedaan token Snap/transaction ID Midtrans.
- [x] Event webhook yang tercatat tetapi belum selesai dapat diproses ulang. Status lunas, entitlement, delivery dan job terkait sekarang satu transaksi; callback tambahan untuk pembayaran yang sama tidak menandainya sebagai duplikat. Status payment lunas tidak diturunkan oleh callback nominal kurang yang terlambat.
- [x] Kode kupon yang sudah tercatat dalam order tidak dapat diganti; buat kupon baru bila perlu. Konflik kuota akibat pembayaran telat atau perubahan kuota menghasilkan peringatan staf dalam transaksi. **Keterbatasan:** harga pesanan yang sudah diterima tetap dihormati dan order dipenuhi, sehingga kuota tetap bisa terlampaui. Batas absolut memerlukan keputusan owner soal pembayaran terlambat dan pengelolaan dana; peringatan bukan jaminan batas absolut.
- [x] ACK antrean offline plugin tidak lagi langsung dianggap selesai: website memeriksa ulang setelah 5 menit tanpa menghabiskan retry, dan menyelesaikan hanya setelah plugin melaporkan perintah dijalankan. Status sengketa tidak tertimpa ACK terlambat; penyelesaian dan job email atomik. **Data lama:** pengiriman yang sebelumnya telanjur ditandai DELIVERED setelah ACK offline perlu direkonsiliasi manual; jangan kirim ulang otomatis tanpa memeriksa pemain dan marker plugin.
- [x] Kotak notifikasi pelanggan untuk pembayaran, pengiriman selesai dan kegagalan plugin permanen tersedia dengan tanda sudah dibaca per akun serta refresh saat halaman terlihat setiap 30 detik. Pesan baru mengikuti preferensi dashboard. Tidak semua jalur kegagalan RCON/timeout dan peristiwa keamanan menghasilkan notifikasi; email wajib dan halaman detail tetap menjadi rujukan.
- [x] Pengujian sandbox: migrasi fresh `0000`–`0011`, 130 unit dan 60 integrasi lulus; tes mencakup replay webhook terputus, referensi silang, nominal kosong, pembayaran terlambat, kupon, ACK offline, finalisasi bersamaan dan isolasi notifikasi. Browser preview terisolasi juga menguji tanda sudah dibaca pada 375 px.
- [ ] Risiko yang masih memblokir produksi: plugin tidak menjamin exactly-once saat crash setelah perintah tetapi sebelum marker, atau perintah hanya sebagian berhasil; kompilasi Java/Gradle dan crash test belum tersedia. Cooldown/inventaris nyata memerlukan integrasi PlayerKits yang tepercaya. Gateway, email, Discord, Turnstile, Java/Floodgate, login browser nyata, CI/artifact dan backup-restore tetap wajib dibuktikan pada staging.
- [ ] Owner perlu memilih apakah syarat kupon/promo rank/kit memotong seluruh subtotal campuran (perilaku saat ini) atau hanya item kategori terkait, dan memutuskan penanganan pembayaran telat vs batas kuota absolut. Belum ada perubahan aturan tanpa persetujuan.

### 15. Pusat bantuan dan riwayat hadiah
- Percakapan bantuan disimpan di database: pelanggan dapat memilih pesanan miliknya, mengirim dan membalas; staf dengan `orders.read` dan MFA dapat membalas atau menutup. Pesan dibatasi 3.000 karakter, 200 pesan per percakapan, dan permintaan/balasan dibatasi laju. Halaman menampilkan 100 percakapan terbaru; data lebih lama tetap tersimpan tetapi belum memiliki paginasi.
- Notifikasi operasional staf kini terlihat dalam feed bersama dengan penyaringan izin; feed 50 terbaru bukan antrean penyelesaian atau status baca per staf. Notifikasi balasan/penutupan bantuan tersedia untuk pemilik. Notifikasi keamanan mencakup perubahan password, aktivasi 2FA, dan penggunaan password benar dari IP berbeda (belum tentu lolos 2FA); bukan deteksi perangkat yang pasti.
- Riwayat hadiah keluar hanya milik pembeli. Hadiah masuk memerlukan UUID Minecraft terverifikasi, hanya untuk order dibayar dan tidak mengekspos kuitansi/detail order pembeli. Keduanya menampilkan 100 terbaru dan status toko, bukan bukti inventaris di game.
- Migrasi baru `0012` wajib diterapkan sebelum fitur digunakan. Pengujian dilakukan pada database PostgreSQL sementara dan browser terisolasi dengan sesi demo, bukan autentikasi browser biasa atau staging layanan nyata.
- Status LuckPerms/PlayerKits dan sisa cooldown live belum tersedia: perlu integrasi API/versi plugin Minecraft yang nyata dan uji staging; tidak menampilkan data rekaan. Tidak ada pergantian season dilakukan.

### 16. Pengujian login browser sebenarnya
- Menambahkan Playwright untuk login pelanggan memakai password, mempertahankan sesi setelah reload, isolasi tiket antar pelanggan, login staf dengan TOTP tanpa bypass, penolakan akses sebelum MFA, balasan dan penutupan tiket. Fixture hanya berjalan bila `E2E_ALLOW_DB_FIXTURES=1` dan wajib memakai database disposable.
- Seluruh **11 tes browser** lulus pada build produksi lokal dengan PostgreSQL disposable; pengujian ini bukan preview yang menyuntikkan sesi. Login dalam iframe Arena masih belum tervalidasi; proxy demo tidak menguji autentikasi.
- Pemeriksaan sumber resmi PlayerKits 2 menunjukkan API `getKitCooldown` mengembalikan teks yang dapat dilokalkan dan memerlukan `Player` online; versi PlayerKits dan nama kit sebenarnya pada server belum diketahui. Jangan menampilkan teks itu sebagai durasi numerik atau menebak status offline. Implementasi live perlu konfirmasi versi, konfigurasi, dan staging nyata.

### 17. Informasi server Minecraft dari pemilik
- Pemilik mengonfirmasi **Minecraft 26.1.2** dengan **PlayerKits 2**; nomor rilis plugin PlayerKits 2 serta jenis/build server (Paper/Purpur/Spigot) belum diketahui. Minecraft 26.1.2 adalah versi game, bukan versi plugin.
- Menambahkan target kompilasi opsional Paper API `26.1.2.build.69-stable` dengan Java 25, sambil mempertahankan target lama 1.21.4/Java 21 sebagai default. CI dikonfigurasi untuk kedua target dengan Gradle yang sesuai dan artefak terpisah. Lingkungan ini tidak memiliki JDK/Gradle dan tidak dapat mengakses repository Paper; **kedua job plugin ini belum dijalankan atau diverifikasi**. Belum ada bukti kompatibilitas runtime.
- PlayerKits 2 API saat ini (`getKitCooldown`) membutuhkan Player online dan mengembalikan string yang dapat dilokalkan, bukan durasi. Integrasi live, perilaku offline dan nama kit harus diverifikasi terhadap plugin dan konfigurasi terpasang; jangan menganggap nilai 5 jam sebagai waktu tersisa.

### 18. Paper build 74 / PlayerKits 2 1.23.1 dan snapshot status
- Pemilik mengonfirmasi **Paper 26.1.2 build 74** dan **PlayerKits 2 1.23.1**; informasi ini menggantikan ketidakpastian versi di bagian 17. Target build diperbarui ke `26.1.2.build.74-stable`.
- Menambahkan snapshot opsional read-only: plugin membaca grup utama LuckPerms dan teks `getKitCooldown` PlayerKits2 1.23.1 pada game thread untuk pemain online; jika data PlayerKits belum dimuat atau API/nama kit tidak cocok, cooldown tidak tersedia. Plugin mengirim batch HMAC, website hanya menyimpan snapshot untuk profil terverifikasi, memeriksa jam, mencegah data lama menimpa data baru, dan menyembunyikan snapshot lebih dari 90 detik. Tampilan secara eksplisit membedakan snapshot dari hak toko; teks bukan hitung mundur atau jaminan klaim. `live-status.enabled` **false** secara default. Nama kit telah dikonfirmasi pemilik sebagai `cipiprime` dan `cipi++` dan menjadi default pada instalasi baru; instalasi lama perlu menambahkan konfigurasi secara manual lalu restart. Maksimal 50 pemain per polling, bergilir.
- Migrasi `0013` menambah satu snapshot terakhir per profil; data tidak disimpan untuk pemain tak terverifikasi, snapshot lama tersembunyi tetapi tetap di database sampai ditimpa atau profil dihapus. Data pemain online lain yang dikirim dalam batch dilewati tanpa disimpan. Review retensi/privasi sebelum produksi.
- Uji PostgreSQL: 69 integrasi lulus termasuk HMAC/replay, pemisahan akun, verifikasi ulang, tanggal kedaluwarsa, data out-of-order dan format Bedrock. 130 unit test lulus. Browser terisolasi 375px memverifikasi tampilan snapshot dan menyembunyikan data kedaluwarsa.
- Pemeriksaan terbatas Java 25: snapshot class dikompilasi dengan Eclipse compiler dan diuji memakai stub API (versi, data belum dimuat, pembersihan teks, batch bergilir dan aturan main thread). **Ini bukan build Gradle dengan Paper API aktual, bukan JAR siap pasang, dan bukan tes Paper/PlayerKits/Floodgate di staging.** Runtime Java 25 tersedia via `jdk4py`, tetapi Gradle, javac dan akses repository Paper tidak tersedia. CI kedua target dan pengujian server nyata masih wajib.
- Setelah perubahan batas batch menjadi 50, clean production build/typecheck/diff-check dan migrasi DB baru lulus; ulang 69 tes integrasi serta 11 tes Playwright login/2FA lulus. Pengujian UI snapshot sebelumnya menggunakan data simulasi pada preview terisolasi.

## 19. Checklist untuk dikerjakan nanti oleh pemilik / pengelola server

> **Status saat ini: belum siap dinyalakan di server produksi.** Kode sinkronisasi sudah disiapkan, tetapi JAR belum dibangun dengan Paper API asli dan belum diuji di server Minecraft. Nama kit yang dikonfirmasi: `cipiprime` dan `cipi++`. Server: Paper **26.1.2 build 74**, PlayerKits 2 **1.23.1**, Java **25**. Centang setiap langkah hanya setelah benar-benar dilakukan. Catatan bagian ini melengkapi dan memperbarui status historis pada bagian 15–17.

### A. Siapkan lingkungan uji yang aman

- [ ] Siapkan **website, database dan server Minecraft staging yang terpisah dari produksi**, dengan versi Paper dan PlayerKits 2 di atas serta LuckPerms; bila pemain Bedrock didukung, pasang Geyser/Floodgate sesuai server. Gunakan akun, pemain dan data uji, bukan pembayaran sungguhan.
- [ ] Backup database serta file konfigurasi/plugin server dan **uji pemulihannya** sebelum mengubah apa pun. Jangan bagikan password, token, shared secret, isi backup, atau data pemain di chat/issue publik.
- [ ] Pastikan jam mesin website dan server Minecraft tersinkronisasi. Pastikan website staging menggunakan HTTPS dan server Minecraft dapat mengaksesnya melalui koneksi keluar. Buat rahasia `PLUGIN_SHARED_SECRET` acak minimal 16 karakter di pengaturan server secara aman; nilainya harus sama dengan `shared-secret` plugin staging, dan jangan ditulis ke Git atau chat.
- [ ] Pastikan migrasi database staging dijalankan secara berurutan sampai **`0017`**, bukan hanya `0016`. Setelah memeriksa URL database staging dan backup, jalankan `npm run db:migrate` dari folder website. Jangan jalankan migrasi terhadap database produksi sebelum backup, pengecekan drift dan rencana rilis disetujui.

### B. Build dan pasang plugin companion di staging

- [ ] Di komputer/runner yang bisa mengakses repository Paper, gunakan **JDK 25** dan **Gradle 9.2.1**. Dari folder `plugin`, jalankan `gradle clean build -PpaperTarget=26.1.2`. Pastikan build dan tes lulus; JAR hasil ada di `plugin/build/libs/`. Alternatif: setelah perubahan tersimpan dalam commit dan dikirim ke branch kerja, jalankan CI branch ini dan ambil artefak `cipismp-companion-paper-26.1.2` setelah job-nya lulus. **Saat ini belum ada hasil build/artefak yang terverifikasi.**
- [ ] Pasang JAR hasil build **hanya di server staging** terlebih dahulu. Periksa log saat server dinyalakan: plugin companion, LuckPerms, PlayerKits 2 dan koneksi polling aktif tanpa error. Cocokkan `website-url` dengan website staging dan `shared-secret` dengan rahasia website staging, tanpa membagikan nilainya.
- [ ] Pada `plugins/CipiStoreCompanion/config.yml` staging, pastikan `polling.enabled: true` dan tambahkan atau periksa bagian berikut. File lama tidak otomatis ditimpa saat plugin diperbarui. Aktifkan snapshot **hanya di staging** setelah langkah sebelumnya lulus:

  ```yaml
  live-status:
    enabled: true
    kit-names: ["cipiprime", "cipi++"]
  ```

- [ ] Restart server staging setelah mengubah konfigurasi. `/cipistore reload` tidak membangun ulang poller dan tidak menerapkan perubahan `live-status`; jangan gunakan `/reload` server sebagai pengganti restart yang aman.

### C. Uji status rank dan cooldown pemain

- [ ] Gunakan akun website uji, hubungkan akun Minecraft melalui `/verify`, lalu masuk ke server staging. Buka **Dashboard → Rank & kit**. Pastikan grup utama LuckPerms dan teks cooldown berasal dari server, nama kit sesuai, serta waktu pengamatan terlihat.
- [ ] Bandingkan hasil masing-masing kit dengan tampilan/klaim di PlayerKits 2: sebelum klaim, segera setelah klaim, dan setelah cooldown habis atau dengan cooldown singkat khusus staging. Pastikan izin dan persyaratan klaim sesuai konfigurasi server. **Teks cooldown adalah snapshot yang diperbarui berkala, bukan hitung mundur tiap detik; grup utama bukan bukti bahwa seluruh permission atau syarat klaim terpenuhi.**
- [ ] Uji pemain keluar dari server atau matikan koneksi plugin: snapshot lama harus hilang dari dashboard setelah lebih dari **90 detik** (halaman terbuka memperbarui sekitar 30 detik). Uji juga data PlayerKits yang belum dimuat, nama kit salah dan plugin dimatikan: hasil yang tidak tersedia tidak boleh ditampilkan sebagai siap klaim.
- [ ] Uji dua akun website terpisah: akun lain tidak boleh melihat snapshot pemain yang bukan miliknya. Uji lepas tautan/verifikasi ulang serta pemain Java dan Bedrock bila digunakan. Konfirmasi bahwa snapshot sebelumnya tidak bocor setelah kepemilikan berubah.
- [ ] Periksa log bila status tidak muncul: versi PlayerKits 2 harus **1.23.1**, nama kit cocok, akun Minecraft terverifikasi, `polling.enabled` dan `live-status.enabled` aktif, kedua jam sinkron dan shared secret cocok. Jangan menempelkan rahasia atau log berisi data pemain saat meminta bantuan.
- [ ] Catat hasil, tanggal, versi, dan bukti yang sudah disamarkan; atur kebijakan privasi/retensi. Website menyimpan hanya satu snapshot terakhir per profil terverifikasi: data lama disembunyikan setelah 90 detik, tetapi tetap tersimpan sampai ditimpa atau profil dihapus. Batch dari plugin dapat memuat UUID pemain online yang tidak terhubung, tetapi website tidak menyimpannya sebagai snapshot.

### D. Sebelum membuka untuk produksi

- [ ] Review dan selesaikan blocker lain di bagian 10–18 serta [`docs/GO_LIVE.md`](docs/GO_LIVE.md): terutama build dan uji crash/duplikasi pengiriman plugin, gateway dan webhook asli, email, Discord, Turnstile, Floodgate, worker/cron, backup/restore, serta keamanan dan legal. Pengiriman **exactly-once belum terbukti**; jangan menganggap perubahan snapshot menyelesaikannya.
- [ ] Tentukan kebijakan pembayaran terlambat yang melewati kuota; cakupan keranjang campuran dapat dipilih owner per promo. Jangan ubah aturan bisnis diam-diam. Jangan melakukan pergantian season hanya karena fitur ini selesai.
- [ ] Setelah staging lulus dan pemilik menyetujui rilis, siapkan backup dan rencana rollback produksi, deploy versi website/plugin yang sudah diuji, terapkan migrasi yang belum ada sampai `0017`, lalu aktifkan sinkronisasi sesuai prosedur staging. Verifikasi kembali dengan akun uji dan pantau log; jika gagal, nonaktifkan `live-status` dan restart server, lalu ikuti rencana rollback. Mengaktifkan fitur ini tidak boleh dianggap bukti bahwa seluruh layanan toko sudah siap produksi.


## 20. Penyelesaian lokal tambahan — 11 November 2026

- [x] Riwayat pesanan, bantuan pelanggan/staf, dan hadiah yang dikirim/diterima menggunakan paginasi 20 entri dengan cursor dua arah dan batas akses tetap di database. Cursor hadiah dikirim/diterima terpisah; pesanan lama milik pengguna dapat dipilih dari halaman detail pesanan untuk bantuan. Percakapan yang baru dibalas dapat berpindah urutan karena diurutkan berdasarkan pembaruan. Migrasi `0014` menambah indeks; terapkan semua migrasi sampai `0014` setelah backup/review.
- [x] Kegagalan permanen plugin (timeout, perintah kosong, retry habis dan ACK gagal) maupun RCON mengubah status order dan membuat notifikasi pelanggan yang aman dalam transaksi yang sama, menghormati preferensi notifikasi dan menjaga status sengketa. Pencatatan attempt RCON gagal ganda diperbaiki. Ini tidak menjamin eksekusi tepat satu kali atau menggantikan rekonsiliasi pengiriman.
- [x] Validasi lokal terbaru: migrasi fresh `0000`–`0014`, **132 unit** dan **75 integrasi** lulus; build produksi dan typecheck lulus. Browser menguji paging maju/mundur di 375 px dan desktop, cursor hadiah independen, serta pemilihan pesanan lama pada preview dengan sesi demo. Playwright produksi **11/11** lulus dengan login/2FA nyata di database uji disposable; satu percobaan sebelumnya timeout saat menunggu balasan, ulang lulus dengan batas tunggu lebih panjang. Database dan fixture uji dibersihkan.
- [ ] Uji lagi pada staging nyata dan selesaikan semua pemeriksaan eksternal di bagian 19; JAR Paper/PlayerKits, gateway, email, OAuth, Turnstile, Floodgate, perilaku login dalam iframe, backup/restore dan crash/duplikasi tetap belum terverifikasi. `live-status.enabled` tetap `false` sampai tahap staging lulus.

## 21. Checklist pengujian staging nyata sebelum rilis

Bagian ini mengumpulkan pekerjaan yang **belum dapat dibuktikan secara lokal**. Gunakan bersama langkah rinci pada bagian 19 dan `docs/GO_LIVE.md`; semua kotak tetap belum selesai sampai diuji pada lingkungan dan layanan yang sebenarnya. Hasil tes lokal/preview demo bukan bukti staging atau izin go-live.

### Persiapan dan deploy terisolasi

- [ ] Siapkan website, worker, PostgreSQL/Redis, domain HTTPS dan server Minecraft **staging terpisah dari produksi**, dengan akun/pemain uji dan konfigurasi yang menyerupai produksi. Pastikan domain, URL database dan kredensial memang untuk staging sebelum melakukan perubahan.
- [ ] Catat commit yang diuji; backup database serta konfigurasi server/plugin, lalu buktikan restore pada lingkungan terpisah. Review journal, schema dan data terhadap migrasi `0000`–`0017`; atasi drift sebelum menjalankan `npm run db:migrate` pada **database staging**. Jangan jalankan seed pada database berisi data nyata.
- [ ] Deploy website, worker dan cron dari versi yang sama; periksa HTTPS, health, log, jam sistem, akses keluar server Minecraft serta konfigurasi secret. Uji restart dan rencana rollback aplikasi/plugin/database pada staging. Jangan simpan secret atau data pribadi dalam bukti pengujian.

### Akun dan layanan eksternal

- [ ] Uji login/logout, refresh, pemulihan password, perubahan email dan sesi, pendaftaran/pemulihan 2FA staf, serta isolasi pelanggan/staf di browser desktop dan ponsel menggunakan akun terpisah. Uji juga browser embedded yang bermasalah; catat penyebab atau keterbatasan platform tanpa mengandalkan sesi demo atau melemahkan keamanan cookie.
- [ ] Gunakan provider email staging/test: pastikan email verifikasi, perubahan email, reset dan transaksi diterima, tautan benar/kedaluwarsa, serta SPF/DKIM/DMARC dan deliverability diperiksa pada domain yang akan digunakan.
- [ ] Jika Discord login dipakai, uji OAuth sungguhan: redirect URI staging, tautkan/lepas akun, login kembali, konflik akun dan kewajiban 2FA staf. Jika tidak dipakai, tetap nonaktif.
- [ ] Jika Turnstile dipakai, uji kunci/domain staging dan kasus token valid, salah, kedaluwarsa serta gangguan provider; pastikan permintaan tidak lolos ketika verifikasi gagal. Uji Redis/rate limit lintas instance bila deployment memakai lebih dari satu instance.

### Pembayaran, pesanan dan pemulihan

- [ ] Konfigurasikan **sandbox/test mode** gateway yang akan dipakai (Midtrans/Tripay sesuai pilihan), dengan webhook HTTPS dan kredensial staging. Uji checkout dan status pembayaran, pembatalan, kedaluwarsa, pembayaran gagal dan berhasil, invoice serta email tanpa transaksi atau dana produksi.
- [ ] Uji webhook tanda tangan salah, duplikat/replay, urutan event berbeda, nominal/referensi tidak cocok, gangguan sebelum pemrosesan selesai dan pembayaran terlambat. Pastikan tidak ada entitlement atau pengiriman tambahan akibat webhook yang sama; periksa audit dan alert staf.
- [ ] Uji diskon otomatis, kupon, keranjang campuran dan kuota saat pembayaran terlambat; owner perlu menyetujui kebijakan yang tercatat di bagian 19 sebelum rilis. Uji hadiah ke penerima terverifikasi dan pastikan penerima tidak melihat invoice pembeli.
- [ ] Uji status sengketa/chargeback dan prosedur eskalasinya pada staging; pastikan status tidak tertimpa oleh hasil pengiriman dan staf mengetahui cara melakukan rekonsiliasi tanpa mengubah database sembarangan.

### Minecraft, plugin dan pengiriman

- [ ] Build dan uji JAR companion memakai **Paper 26.1.2 build 74, JDK 25 dan Gradle 9.2.1**; periksa job CI/artefak commit yang benar, isi JAR dan checksum. Pasang hanya pada server staging dengan LuckPerms dan **PlayerKits2 1.23.1**; detail konfigurasi dan urutan ada di bagian 19.
- [ ] Uji `/verify` untuk Java dan, bila didukung, Bedrock melalui Geyser/Floodgate nyata: identitas/UUID, prefix, kode salah/kedaluwarsa/digunakan ulang, akun berbeda dan unlink/relink. Jangan menyatakan dukungan Bedrock siap sebelum UUID Floodgate terverifikasi.
- [ ] Jalankan alur pembayaran sandbox → antrean → polling/ACK → rank atau permission kit pada pemain yang benar. Periksa isi kit dan cooldown in-game untuk `cipiprime` dan `cipi++`; uji penerima hadiah, pemain online/offline dan login kembali.
- [ ] Uji restart/crash plugin atau website, ACK hilang, retry, perintah sebagian/gagal, penyimpanan antrean gagal, timeout dan notifikasi kegagalan. Periksa hasil di game, database dan audit sebelum retry manual; rekonsiliasi delivery lama yang pernah ditandai selesai terlalu dini. **Exactly-once belum terbukti**, sehingga jangan melakukan retry massal tanpa pemeriksaan.
- [ ] Jika RCON dipakai, uji koneksi, kredensial, kegagalan/retry dan hasil perintah pada server staging; jika tidak dipakai, biarkan tidak aktif. Uji job worker/cron, expiry dan transisi season hanya dengan data/season staging, bukan season produksi.
- [ ] Ikuti bagian 19 untuk menguji snapshot LuckPerms dan cooldown PlayerKits online, isolasi profil dan batas 90 detik. `live-status.enabled` tetap **false** secara default; aktifkan hanya di staging untuk pengujian dan jangan aktifkan di produksi sebelum disetujui. Snapshot bukan bukti inventory atau kelayakan klaim.

### Operasional dan keputusan rilis

- [ ] Uji backup terjadwal dan restore, monitoring/alert, akses staf sesuai izin dan MFA, bantuan pelanggan, pagination, retensi/privasi data, prosedur dukungan serta pemulihan ketika provider/server tidak tersedia.
- [ ] Review legal dan hak penggunaan aset, konfigurasi bisnis, pengamanan secret, dan keputusan owner yang masih terbuka di bagian 4 serta 19. Dokumentasikan keterbatasan yang diterima dan mitigasinya.
- [ ] Catat setiap hasil: **tanggal; commit/build/checksum; lingkungan dan versi; skenario; lulus/gagal; bukti yang disamarkan; penanggung jawab; tindak lanjut**. Perbaiki dan ulangi kasus gagal. Setelah seluruh gerbang disetujui, buat rencana deploy, backup dan rollback produksi; tindakan produksi memerlukan persetujuan owner tersendiri.

## 22. Pengamanan pengiriman dan pekerjaan operasional lanjutan

### Yang sudah dikerjakan secara lokal

- [x] RCON mengklaim baris secara atomik sebelum menjalankan perintah. Kegagalan RCON ditandai `DEAD` untuk pemeriksaan, bukan retry otomatis; jika worker mati saat eksekusi, status `SENT` dipertahankan sebagai hasil tidak pasti. Polling plugin tidak merebut lease RCON. Pengiriman yang pernah diproses/diantrekan pada satu metode tidak otomatis dipindahkan ke metode lain.
- [x] Plugin menyimpan intent ke disk sebelum menjalankan perintah dan memblokir eksekusi ulang bila hasil tidak pasti; marker selesai memungkinkan ACK diulang tanpa mengulang perintah. Antrean YAML yang tidak dapat dibaca kini menghentikan plugin, bukan dianggap kosong. Marker tidak dipangkas otomatis; pantau disk. Pengamanan ini memilih tertahan untuk pemeriksaan daripada berisiko menggandakan efek.
- [x] Kirim ulang di panel hanya untuk `FAILED`/`DEAD`, tidak untuk order sengketa, dan membutuhkan konfirmasi staf bahwa hasil in-game sudah diperiksa. Tidak tersedia tombol untuk memulihkan kasus `SENT` RCON atau intent plugin yang hasilnya tidak pasti: eskalasi dan rencanakan koreksi terarah, jangan hapus marker/reset database sembarangan.
- [x] Perbarui runbook: backup file antrean dan intent bersama database, verifikasi restore terisolasi, pemantauan terpisah dan langkah rekonsiliasi. Contoh Compose mengharuskan password database eksplisit, host database contoh cocok dengan service `db`, dan port database default hanya bind ke localhost.
- [x] Tambahkan pengujian database lokal untuk claim RCON bersamaan, RCON gagal, status `SENT` yang tidak pasti, perpindahan metode, otorisasi cron, expiry order, health dan pemulihan job tertinggal. Migrasi fresh sampai `0014`, **132 unit** dan **80 integrasi** lulus; typecheck dan build web produksi lulus. Pengujian Java intent/restart/konkurensi/storage serta alur service terbatas menggunakan stub berjalan di sandbox; ini **bukan** build atau tes Paper nyata. Tes JUnit guard juga ditambahkan untuk CI.
- [ ] Tes browser produksi terbaru **10/11**: langkah balasan bantuan staf kadang terus loading. Trace menunjukkan POST 200 dan balasan tersimpan dalam respons, tetapi tampilan tidak selesai; penyebab belum terbukti. Sebelumnya tes yang sama pernah lulus. Investigasi dan perbaiki sebelum rilis, jangan hanya memperpanjang timeout. Trace juga menunjukkan CSP memblokir skrip pada halaman 403 statis; uji dan perbaiki tanpa melemahkan CSP.
- [x] Pemeriksaan GitHub: run lama [`43018442669`](https://github.com/iyudhistira484-maker/cipismp-website/actions/runs/43018442669) untuk commit `6b7fdc9` menunjukkan quality, Playwright dan Docker sukses; plugin gagal karena Paper repository mengembalikan HTTP 503. Ini hasil **commit lama**, bukan hasil perubahan sekarang. Workflow kini juga menyiapkan checksum artefak JAR, tetapi belum dijalankan untuk perubahan ini.

### Batas yang masih wajib dibereskan sebelum rilis

- [ ] Build dan uji JAR plugin yang baru dengan Paper/LuckPerms sesungguhnya, termasuk crash sebelum/saat/sesudah perintah, offline join, timeout, partial failure, disk penuh/rusak, ACK hilang dan restart. Uji filesystem hosting mendukung pembuatan marker serta `fsync` file/direktori; bila tidak, plugin sengaja menolak eksekusi.
- [ ] Exactly-once tetap **belum dijamin**. Intent hanya ada pada storage satu instalasi plugin: server/plugin ganda, plugin lama, restore database/plugin dari waktu berbeda, kehilangan/rollback storage dan kegagalan filesystem harus direkonsiliasi. Tetapkan kebijakan retensi marker tanpa menghapus bukti deduplikasi yang masih dibutuhkan.
- [ ] Review delivery historis sebelum memakai versi baru atau berganti mode, termasuk antrean offline, hasil RCON `SENT`/`FAILED`, serta status yang pernah salah selesai. Uji prosedur pemulihan terarah yang disetujui owner; jangan retry massal dan jangan menerapkan perubahan pada server produksi tanpa persetujuan.
- [ ] Jalankan Docker Compose/build dan smoke test web/worker/migrate pada runner Docker, backup serta restore nyata dengan file plugin, monitoring/alert dan crash recovery di staging. Sandbox sesi ini tidak memiliki Docker atau utilitas `pg_dump`/`psql`; contoh runbook belum membuktikan backup produksi aman.
- [ ] Setelah perubahan final di-commit dan di-push ke branch kerja, jalankan dan periksa **semua job CI**, JUnit plugin serta checksum JAR `cipismp-companion-paper-26.1.2`; uji artefak tersebut di staging. Tidak ada hasil CI/JAR terverifikasi untuk working tree sekarang.

### Keputusan pemilik — belum disetujui, jangan diubah sepihak

- [x] **Akun staf:** owner memilih akun staf yang sama dikonversi menjadi `CUSTOMER` saat akses staf dicabut. Konversi tidak menggabungkan akun yang sudah terpisah. Pengujian dan peninjauan sesi tercatat di bagian 4; belum ada akun nyata yang diubah.
- [x] **Staf dan LuckPerms — keputusan owner:** staf tidak boleh membeli rank, termasuk melalui akun pemain lain miliknya, maupun menerima rank sebagai hadiah; grup staf harus tetap dipertahankan.
- [ ] Terapkan dan uji larangan, termasuk checkout server-side dan penerima hadiah. Lindungi grup staf dari perubahan rank/pencabutan di semua jalur; template `parent set` saat ini dapat mengganti group lain dan belum aman untuk dinyatakan sesuai keputusan. Rancang cara identifikasi tepercaya yang mencakup akun lain milik staf dan pemain offline; tanpa daftar/pemetaan identitas yang lengkap sistem tidak dapat mengetahui semua akun alternatif. Tentukan perilaku aman saat identitas atau data server tidak tersedia. Jangan menganggap snapshot opsional sebagai otorisasi live. Uji seluruh jalur pemberian/revoke dan identitas di staging; belum ada perubahan pada grup server nyata.
- [x] **Cakupan promosi:** owner ingin mengatur diskon/kupon sendiri nanti. Sistem menyediakan pilihan cakupan per promo; aturan lama tetap seperti sebelumnya.
- [ ] **Kuota pembayaran terlambat:** owner masih perlu menentukan kebijakan; implementasi saat ini menghormati pembayaran dan memperingatkan staf. Aturan diskon terbesar menang dan kupon menang saat seri tetap dipertahankan.
- [ ] **Legal dan aset:** pemilik/penasihat hukum perlu menyetujui syarat penjualan, privasi, penanganan sengketa/refund sesuai hukum dan retensi data, serta membuktikan hak penggunaan komersial logo/sprite/video/screenshot atau mengganti aset yang haknya tidak jelas. Hasil review dan pihak yang menyetujui harus dicatat.


## 23. Pengaturan diskon dan kupon oleh pemilik

- [x] Owner memilih mengatur kapan dan bagaimana memberi promo sendiri; tidak ada promo yang dibuat atau diaktifkan otomatis dalam pekerjaan ini. Form kupon dan diskon otomatis menyediakan pilihan potongan dari seluruh keranjang atau hanya jenis rank/kit yang dipilih. Jika jenis tidak dibatasi, keduanya sama. Syarat minimum dan tingkat kupon selalu menggunakan total seluruh keranjang; potongan nominal dibatasi oleh subtotal yang tercakup.
- [x] Migrasi `0015` menambahkan pengaturan tersebut dan mempertahankan perilaku promo lama (seluruh keranjang). Promo terbesar tetap menang dan kupon menang jika seri; pesanan lama tidak dihitung ulang. Migrasi dan seluruh perubahan harus direview serta diterapkan di staging setelah backup, bukan di database produksi tanpa persetujuan.
- [x] Validasi lokal: **136 unit dan 81 integrasi** lulus pada database disposable, termasuk cakupan persentase/nominal, upgrade, tier dan aturan tie; typecheck dan build produksi lulus. Uji migrasi pada baris lama mempertahankan nilai sebelumnya. Form kupon dan promo diuji dengan sesi demo pada database preview terisolasi, data uji dihapus. Ini bukan pengujian gateway/staging nyata; masalah browser bantuan di bagian 22 tetap terbuka.
- [ ] Uji kedua pilihan pada staging dan tentukan kebijakan pembayaran terlambat yang melampaui kuota. Keputusan/implementasi larangan rank untuk staf tetap terpisah dan belum selesai.

## 24. Tindak lanjut keselamatan rank dan regresi browser

- [x] Checkout menolak pembeli dengan role staf untuk pesanan berisi rank, dan menolak penerima rank (termasuk hadiah) yang profil Minecraft-nya terverifikasi terhubung ke akun staf. Comp rank juga memeriksa UUID penerima yang dikenal. Tes integrasi mencakup hadiah dan akun yang sudah diturunkan ke CUSTOMER.
- [ ] **Belum memenuhi seluruh kebijakan staf:** akun alternatif yang tidak terhubung/terverifikasi, pembelian tamu, staf Minecraft tanpa role website, serta perubahan role/identitas sesudah checkout tidak dapat diketahui atau diblokir secara menyeluruh oleh pemeriksaan ini. Owner perlu kebijakan identitas dan daftar akun yang tepercaya; rancang enforcement ulang saat pembayaran/pengiriman dan perlakuan pembayaran tertunda tanpa menghilangkan dana. Jangan aktifkan penjualan rank sampai gap ini ditangani dan diuji.
- [x] Seed baru memakai LuckPerms `parent add/remove`; migrasi 0016 mengganti **hanya pasangan** template 0008 yang masih persis default. Migrasi diuji dengan pasangan default dan pasangan sebagian dikustomisasi; kustomisasi dibiarkan utuh.
- [ ] Migrasi tidak mengubah perintah yang sudah tersalin di delivery website atau queue plugin offline, dan tidak memvalidasi template kustom maupun hierarchy LuckPerms. Sebelum aktivasi, hentikan worker/polling dan rekonsiliasi seluruh antrean/salinan perintah; review template, inheritance, penggunaan `parent set` dan jalur comp/revoke/manual bersama owner, lalu uji pada server staging. Jangan menganggap `add/remove` saja menjamin keamanan semua grup atau perintah arbitrer.
- [x] Balasan/penutupan bantuan memakai refresh klien setelah action; root layout dibuat dinamis agar nonce CSP cocok, termasuk halaman legal dan 403. Build produksi, tes browser sesi nyata tiga kali, dan suite browser lengkap 12/12 lulus secara lokal. Penyebab loading intermittent sebelumnya belum terbukti; perlu uji staging, browser lain, koneksi lambat, dan preview iframe. Rendering dinamis berdampak pada caching dan performa; ukur sebelum produksi.
- [ ] Uji crash/retry dan pemulihan pada Paper/hosting sebenarnya; penanda intent mencegah replay saat hasil tidak pasti tetapi dapat memerlukan rekonsiliasi dan tidak menjamin tepat sekali. Paper JAR dan CI perubahan terbaru belum teruji; kegagalan CI lama berasal dari HTTP 503 repositori Paper, bukan bukti perbaikan.

## 25. Pengaman perintah dan pemeriksaan ulang pengiriman

- [x] Website membatasi perintah pengiriman ke `lp user <target> parent add/remove` untuk vip/mvp/elite/legend, atau permission PlayerKits2 cipiprime/cipi++; target harus cocok dengan UUID atau username aman penerima. Perintah lama seperti `parent set`, penghapusan grup lain, target lain dan perintah arbitrer ditahan sebagai DEAD dengan pemberitahuan; pemeriksaan ada pada jalur polling plugin dan RCON. Checkout menolak GRANT kosong/tidak aman dan REVOKE upgrade kosong/tidak aman sebelum membuat pembayaran; template tetap diperiksa lagi saat dispatch. Comp memeriksa sebelum memberikan entitlement.
- [x] Pengiriman rank yang diketahui ke staf diperiksa kembali saat dispatch berdasarkan pembeli website atau profil Minecraft terverifikasi milik staf; pembelian yang sudah lunas tetapi ditahan membutuhkan rekonsiliasi pembayaran, bukan dikirim diam-diam. Tidak mencakup akun alternatif yang tidak terdata, perubahan bersamaan setelah pengecekan, atau queue yang sudah terlanjur ada di plugin lama.
- [x] Kode plugin yang baru memeriksa daftar perintah dan penerima lagi, termasuk saat memproses queue offline lama; perintah parent ditolak jika API LuckPerms tidak aktif, dan kegagalan API tidak diteruskan ke konsol. Rangkaian perintah berhenti pada kegagalan pertama, tetapi perintah sebelumnya tetap mungkin sudah diterapkan.
- [ ] **Perubahan kompatibilitas:** template kustom di luar daftar aman tidak akan dikirim; nama Bedrock berisi spasi harus memakai `{uuid}` pada template. Review konfigurasi dan lakukan pengujian staging sebelum menerima pembayaran; item yang sudah di-queue dengan perintah lama perlu rekonsiliasi. Plugin lama yang masih berjalan belum memiliki pengaman baru dan queue offline-nya tetap dapat dieksekusi: hentikan polling/plugin lama sebelum pemeriksaan dan instalasi yang telah diuji.
- [ ] `vip/mvp/elite/legend` hanya nama yang diizinkan, bukan bukti bahwa keempat grup atau inheritance-nya aman pada server nyata. Owner perlu memverifikasi grup staf bukan salah satu dari grup tersebut, tidak diwariskan/terpengaruh oleh konfigurasi rank, dan bahwa seluruh akun alternatif staf terdaftar melalui mekanisme identitas yang tepercaya. Pencegahan semua pembelian rank oleh akun alternatif yang tidak terdata belum terpenuhi; jangan membuka penjualan rank sebelum kebijakan dan pengujian selesai.
- [ ] Java baru hanya diuji secara terbatas dengan stub Bukkit/queue; JUnit/Gradle nyata, build JAR Paper 26.1.2, LuckPerms, PlayerKits2/Floodgate dan uji crash/restart pada hosting nyata belum diverifikasi. Semua pengamanan hanya berlaku setelah rilis dan instalasi yang disetujui; tidak ada perubahan pada server nyata.

## 26. Daftar grup LuckPerms yang diberikan owner

- [x] Output `lp listgroups` halaman 1–2 yang diberikan owner menunjukkan 15 grup dan weight: `owner` 1000, `co-owner` 101, `manager` 100, `sr-admin` 99, `admin` 98, `sr-moderator` 97, `moderator` 96, `helper` 95, `trainee` 94, `legend` 93, `elite` 92, `mvp` 91, `vip` 90, `freerank` 67, `default` 0. Daftar ini dilaporkan pengguna, bukan hasil akses atau pemeriksaan langsung pada server.
- [x] Owner mengonfirmasi sembilan grup staf: `owner`, `co-owner`, `manager`, `sr-admin`, `admin`, `sr-moderator`, `moderator`, `helper`, dan `trainee`.
- [ ] Daftar grup/weight tidak mengungkap semua konteks, izin efektif, assignment pemain, atau konfigurasi primary group; jangan menyimpulkan staf aman hanya karena weight lebih tinggi atau nama grup berbeda. Output `info` dari semua sembilan grup staf, empat rank, `default`, dan `freerank` telah diberikan, tetapi masih perlu pengujian inheritance/konteks dan izin efektif di staging. Tidak ada grup server yang diubah.
- [x] Owner memberikan output `lp group ... info` untuk owner, co-owner, sr-admin, admin, sr-moderator, moderator, helper, trainee serta legend, elite, mvp, vip. Keempat grup rank menampilkan parent langsung `default`; delapan output staf yang diberikan tidak menampilkan bagian Parent Groups. Output mencantumkan contextual data mode server dan tidak membuktikan seluruh konteks, assignment pemain, izin efektif, atau keadaan server saat pengiriman. Output lanjutan `manager`, `default`, dan `freerank` tercatat di bawah; rincian hierarchy/izin dan jalur identitas alternatif staf masih perlu diuji. Tidak ada perubahan grup pada server.
- [x] Output tambahan owner: `manager` tidak menampilkan bagian Parent Groups; `default` tidak menampilkan Parent Groups dan info menyatakan weight None (listgroups sebelumnya menampilkan 0); `freerank` menampilkan parent langsung `default`. Ini laporan konteks server dari owner, bukan pengujian semua konteks atau assignment akun pemain.
- [x] Plugin versi kerja ini memakai daftar sembilan grup staf yang dikonfirmasi, dan sebelum `parent add/remove` memeriksa primary group, node membership langsung, serta grup terwaris non-contextual penerima dan grup rank; jika menemukan staf atau pemeriksaan API gagal, perubahan ditahan. Stub Java lokal menguji grup staf langsung/terwaris/primary, rank yang mewarisi staf, kegagalan dan penerima biasa. Nama grup harus diperbarui bila konfigurasi staf berubah.
- [x] Perubahan rank otomatis melalui RCON ditahan karena tidak dapat memeriksa LuckPerms secara live. Checkout rank otomatis ditolak sebelum pembayaran jika server default bukan mode plugin; comp rank serupa ditolak. RCON tetap terbatas ke permission kit yang diizinkan. Mode plugin di website saja bukan bukti plugin baru telah terpasang atau berhasil berjalan.
- [ ] API LuckPerms, semua konteks/inheritance, perubahan grup bersamaan, Java JAR pada Paper nyata, queue offline lama dan alternatif staf yang tidak memiliki grup staf sendiri tetap belum diverifikasi/tercakup. Cek staging termasuk timeout API dan jangan buka penjualan rank sebelum kebijakan identitas dan rilis tervalidasi. Pengiriman RCON rank dan plugin lama tidak boleh digunakan untuk mem-bypass pemeriksaan.
- [x] Owner menegaskan grup `freerank` khusus event; otomatisasi toko tidak boleh menetapkan, mencabut, atau mengubah grup tersebut. Daftar perintah website/plugin hanya mengizinkan add/remove empat grup rank toko dan menolak `freerank` serta `parent set`. Tambahan unit test memastikan kebijakan ini. Pastikan pada staging bahwa upgrade/revoke mempertahankan group event, dan rekonsiliasi perintah lama/queue plugin sebelum aktivasi; sistem lain atau plugin versi lama tidak tercakup.

## 27. Daftar UUID staf yang dikelola Owner

- [x] Migrasi `0017` menambahkan daftar UUID Minecraft utama/alternatif yang dikaitkan ke akun website staf. Hanya Owner dengan 2FA/izin `staff.write` dapat mencatat atau menghapus UUID dari `/admin/staf`; alasan wajib, dan mutasi serta audit tersimpan dalam transaksi yang sama. UUID harus lengkap, dinormalisasi, dan tidak boleh terduplikasi. Tidak ada data staf nyata yang diisi otomatis.
- [x] Checkout rank memeriksa UUID pembeli dan penerima hadiah, akun website staf serta profil terverifikasi yang cocok dengan UUID terdaftar. Comp dan dispatch rank memeriksa UUID yang diketahui; pesanan yang sudah dibayar tetapi tertahan perlu rekonsiliasi. Jika role terkait turun ke CUSTOMER, pembatasan daftar nonaktif sehingga akun yang sama dapat menjadi pelanggan; catatan tetap ada dan aktif kembali bila role staf dipulihkan. Perubahan role website tidak mengubah LuckPerms.
- [ ] Perlindungan daftar hanya mencakup UUID yang benar dan terdaftar saat pemeriksaan. Pembelian sebagai tamu atau akun alternatif yang belum diketahui, data identitas keliru, perubahan bersamaan, serta perintah yang sudah tersimpan di plugin lama/offline sebelum pembaruan tidak dapat dijamin dicegah. Tinjau antrean dan saldo pembayaran sebelum menambah/menghapus UUID atau mengubah role; jangan menganggap daftar sebagai bukti kepemilikan atau solusi identifikasi otomatis. Owner harus memverifikasi dan memperbarui data, melindungi privasi dan menguji Java/Bedrock di staging.
- [ ] Jalankan migrasi `0017` hanya di database staging dengan backup, uji formulir dan kontrol akses Owner, lalu uji checkout/hadiah/comp/dispatch, konversi staf, daftar yang belum lengkap, queue offline, plugin baru dan versi lama dalam lingkungan terisolasi. Jangan men-deploy atau memasukkan data nyata tanpa rencana rilis dan persetujuan.
- Validasi lokal terbaru pada database disposable: migrasi sampai `0017`, 139 unit, 90 integrasi, build dan 13 E2E lulus; dua skenario login/2FA bantuan dan registry diulang tiga kali masing-masing dan lulus. Pada percobaan sebelumnya, refresh client sempat menampilkan data lama meski POST sukses; kedua formulir kini memuat ulang halaman setelah sukses. Ini bukan bukti bahwa seluruh penyebab intermittent di semua kondisi sudah terselesaikan.

## 28. Antrean rank offline dan audit registry

- [x] Plugin baru tidak mengeksekusi paket rank dari salinan antrean lokal saat pemain login atau perintah flush. Saat pemain online, paket rank harus di-lease lagi oleh website, sehingga pemeriksaan UUID staf dijalankan ulang. Marker selesai tetap dapat membersihkan antrean tanpa menjalankan ulang. Paket yang memuat rank dan kit bersama-sama juga menunggu lease baru; kit saja masih dapat diproses dari antrean lokal. Jeda normal setidaknya sampai polling website berikutnya setelah waktu antre lima menit.
- [x] Uji integrasi memastikan penambahan UUID staf sesudah ACK offline menyebabkan polling berikutnya menahan rank; uji transaksi memastikan kegagalan insert audit menggagalkan penambahan/penghapusan registry. Uji Java mencakup klasifikasi paket rank.
- [ ] Salinan rank yang sudah ditahan/dibatalkan di website bisa tetap tercatat di queue plugin dan perlu rekonsiliasi manual; jangan hapus tanpa bukti. Plugin lama tetap bisa menjalankan queue sendiri, dan lease baru masih tidak menutup sepenuhnya race setelah pemeriksaan website. Uji JAR, crash, status pemain, antrian yang tertahan dan pergantian plugin pada Paper/LuckPerms staging sebelum rilis; tidak menjanjikan exactly-once atau identifikasi alternatif tak dikenal.

## 29. Penemuan: server CipiSMP offline-mode

Owner menyatakan server Paper offline-mode dengan LoginSecurity **3.3.1** (lenis0012), Floodgate **2.2.5-SNAPSHOT b138-fc99cfc**, dan Geyser-Spigot **2.11.0-SNAPSHOT**. Ini mengubah asumsi identitas yang sebelumnya dipakai; jangan aktifkan checkout/pengiriman produksi berdasarkan hasil tes untuk online-mode.

- [ ] Website `MINECRAFT_LOOKUP_MODE=mojang` mengambil UUID Mojang, bukan UUID offline Paper. `mock` memakai UUID hasil tebakan dari nama dan bukan opsi produksi. Kasus beda kapitalisasi, rename, hadiah, profil lama, kepemilikan entitlement dan pembeli/penerima harus dianalisis; identitas yang benar harus ditetapkan secara tepercaya dari server, bukan hanya tebakan nama. Jangan mengubah UUID atau migrasi data pemain nyata otomatis.
- [ ] Plugin toko saat ini memproses `PlayerJoinEvent` dan polling tanpa integrasi LoginSecurity; `/verify` juga tidak secara eksplisit memeriksa autentikasi. Belum terbukti apakah konfigurasi LoginSecurity di server mencegah seluruh jalur tersebut. Tidak boleh menyamakan masuk server dengan login berhasil.
- [ ] Sumber LoginSecurity tag `v3.3.1` menunjukkan `LoginSecurity.getSessionManager().getPlayerSession(player)` dan `PlayerSession.isLoggedIn()` / `isAuthorized()`. `isLoggedIn()` memerlukan password terdaftar sedangkan `isAuthorized()` dapat benar untuk sesi bypass/tanpa password. Tentukan kebijakan Bedrock serta bypass dan API/lifecycle/threading, kegagalan plugin, logout/reconnect, versi dan dependensi sebelum implementasi fail-closed; uji API dengan JAR asli, bukan semata stub. https://github.com/lenis0012/LoginSecurity/tree/v3.3.1
- [ ] `VerifyService.isBedrock` memakai `uuid.version() == 3`, yang tidak membuktikan Floodgate dan juga cocok untuk UUID Java offline. Payload edisi saat ini tidak menjadi bukti; integrasikan API Floodgate yang sesuai dan uji Geyser, prefix, XUID/UUID asli, nama dan login Bedrock. Jangan percaya prefix atau UUID versi tertentu sebagai bukti tanpa validasi.
- [ ] Setelah pengaman LoginSecurity dan identitas server selesai, uji di staging: sebelum/sesudah login, logout dan gagal login, server restart, plugin auth hilang/tidak siap, sesi bypass, pemain Java/Bedrock, perubahan nama dan kapitalisasi, staf/alternatif/hadiah, antrean dan polling/ACK/rekonsiliasi. Skenario otomatis harus tetap berjalan tanpa persetujuan manual per pembelian. Runtime Paper/LS/Floodgate dan gateway nyata belum dibuktikan.

## 30. Penyiapan akun website staf

- [x] Owner dapat mempromosikan akun pelanggan terverifikasi menjadi ADMIN/SUPPORT melalui detail pelanggan tanpa membuat atau menggabungkan akun. Email terverifikasi dan 2FA yang diaktifkan pemilik akun adalah syarat; Owner wajib memeriksa identitas secara terpisah, mengisi alasan dan konfirmasi. Update role dan audit ditulis atomik; action role lama tidak lagi boleh mempromosikan pelanggan sebagai jalan pintas. Role OWNER tetap tidak dibuat melalui UI ini.
- [ ] Data staf nyata dan UUID tidak dimasukkan otomatis; masing-masing harus membuat akun sendiri, lalu Owner melakukan pencocokan, promosi dan pendaftaran UUID setelah website siap. Penyiapan owner awal serta akses email nyata memerlukan lingkungan dan prosedur yang aman. Kelengkapan daftar alternatif serta kompatibilitas offline-mode/LoginSecurity/Floodgate tetap belum terbukti.
