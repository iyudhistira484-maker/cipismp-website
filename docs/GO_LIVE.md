# Checklist go-live

Dokumen ini dipakai sekali saat pertama kali merilis toko ke produksi, lalu disimpan
sebagai catatan audit. Centang setiap baris; jangan meluncurkan sebelum semuanya hijau.

### Batas verifikasi otomatis vs. live

GitHub Actions dikonfigurasi untuk typecheck, migrasi + unit/integration test, build produksi,
smoke test Playwright, validasi `docker compose config` + image produksi, serta build
plugin Paper dengan JDK 21/Gradle/JUnit. Hasil run dan artifact untuk commit rilis harus diperiksa; konfigurasi bukan bukti bahwa run tersebut lulus. Tes provider memakai mock jaringan untuk
memastikan format signature, pemetaan status dan kontrak request; tes plugin membandingkan
HMAC website dengan Java. CI **tidak** memakai credential live, akun Discord/Resend,
widget Turnstile publik, atau server Minecraft, sehingga bagian transaksi/email/OAuth/
Turnstile/plugin di checklist berikut tetap perlu diuji manual di staging/produksi.

## 1. Infrastruktur

- [ ] Server dengan Docker + Docker Compose, RAM ≥ 2 GB, disk ≥ 20 GB.
- [ ] Nama domain toko (mis. `store.cipismp.my.id`) mengarah ke server; TLS aktif.
- [ ] Port 3000 (web) hanya diekspos lewat reverse proxy (Caddy/Nginx), bukan langsung.
- [ ] PostgreSQL 16 hanya bisa diakses dari jaringan internal; backup harian aktif.
- [ ] Redis (opsional) aktif bila toko dijalankan lebih dari satu instance web.
- [ ] Zona waktu container `Asia/Jakarta`; jam server sinkron NTP.

## 2. Konfigurasi `.env`

- [ ] `APP_URL` & `NEXT_PUBLIC_APP_URL` memakai URL publik **https**, tanpa slash di akhir.
- [ ] `SESSION_SECRET` ≥ 32 karakter acak, berbeda dari lingkungan lain.
- [ ] `ENCRYPTION_KEY` base64 dari 32 byte (`openssl rand -base64 32`) dan disimpan di
      password manager — kehilangan kunci ini membuat kredensial gateway tidak terbaca.
- [ ] `DATABASE_URL` benar, `POSTGRES_PASSWORD` kuat.
- [ ] `PLUGIN_SHARED_SECRET` ≥ 16 karakter acak dan **sama** dengan `shared-secret` di config plugin.
      Hosting Minecraft dapat melakukan DNS + koneksi keluar HTTPS ke `APP_URL`.
- [ ] `CRON_SECRET` ≥ 16 karakter.
- [ ] `EMAIL_PROVIDER=resend` atau `smtp` (bukan `outbox`), kredensial terisi.
- [ ] **STOP untuk CipiSMP offline-mode sampai staging dan rekonsiliasi selesai:** `mojang` tidak sesuai UUID Java offline; `mock` hanya dev/test. Kode mode `offline`, pemeriksaan LoginSecurity dan Floodgate serta protokol plugin v2 telah disiapkan, tetapi belum terbukti di server nyata. Jangan aktifkan checkout/pengiriman produksi sebelum pengujian dan persetujuan rilis.
- [ ] `TURNSTILE_ENABLED=1` beserta site/secret key.
- [ ] Pada staging/domain yang terdaftar, form menerima token Turnstile valid dan menolak
      token kosong/tidak valid; matikan hanya bila environment memang non-produksi.
- [ ] `PAYMENT_DEFAULT_PROVIDER` sesuai gateway aktif, mode `live` untuk produksi.
- [ ] `SEED_OWNER_*` terisi, password kuat, dan diganti setelah login pertama.

## 3. Database & data awal

- [ ] Sebelum migrasi ke database yang sudah berisi data, cocokkan tabel journal Drizzle,
      schema aktual, dan data produksi dengan seluruh migrasi (`0000`–`0019`) pada salinan
      backup terisolasi. Periksa khususnya `0006_product_artwork.sql` (rebrand rank + data),
      `0007_cipi_kits.sql` (upsert kit), `0008_cipi_rank_catalog.sql` (harga/tier/template rank),
      dan `0009_plugin_polling.sql` (heartbeat plugin + token lease delivery);
      rekonsiliasi drift sebelum menerapkan apa pun.
      `drizzle-kit check` hanya memeriksa metadata migrasi, bukan drift schema/data produksi.
- [ ] Backup database produksi berhasil dan pemulihan ke lingkungan terpisah sudah diuji.
- [ ] `docker compose up -d --build` sukses; service `migrate` selesai tanpa error.
- [ ] `docker compose run --rm seed` membuat season, rank, kit, template perintah, owner.
- [ ] Season 1 berstatus **ACTIVE** dengan tanggal selesai yang benar (WIB).
- [ ] Katalog rank tepat: **Cute Rp10.000 / vip**, **Pop Rp30.000 / mvp**,
      **Milk Rp60.000 / elite**, **Star Rp100.000 / legend**; cek tier 1–4, benefit, dan
      template setelah migrasi `0016_safe_rank_templates.sql`. Migrasi hanya mengganti pasangan default
      0008 yang sama persis menjadi `parent add`/`parent remove`; template kustom atau yang
      hanya sebagian diubah tetap perlu diperiksa owner. Delivery yang sudah dibuat menyimpan
      salinan perintah lama dan tidak diperbarui; hentikan pengiriman dan rekonsiliasi antrean
      website serta queue offline plugin sebelum aktivasi. Verifikasi hierarchy LuckPerms di staging.
- [ ] Hanya **CipiPrime** (Rp35.000) dan **Cipi++** (Rp75.000) yang tayang sebagai kit.
      `maxPerSeason=1` dan `cooldownHours=0`; template GRANT/REVOKE memakai tepat
      `playerkits.kits.cipiprime` dan `playerkits.kits.cipi++`.
- [ ] Halaman `/rank` dan `/kit` menampilkan nama season + tanggal berakhir.

## 4. Pembayaran

- [ ] Admin/Owner mengatur metode QRIS/VA/e-wallet di `/admin/pembayaran` sesuai yang aktif
      di akun Tripay/Midtrans; checkout hanya menampilkan metode yang dicentang.
- [ ] Owner mengisi kredensial Tripay/Midtrans di `/admin/pembayaran` dengan mode **live**,
      lalu menjalankan uji kesiapan provider. Kredensial dan diagnostik tetap Owner-only.
- [ ] URL webhook terdaftar di dashboard gateway:
      `https://<domain>/api/webhooks/tripay` atau `/api/webhooks/midtrans`.
- [ ] Di sandbox masing-masing gateway, buat transaksi untuk metode yang dipakai dan
      pastikan callback diterima; lakukan sekali di Tripay dan sekali di Midtrans jika
      keduanya diaktifkan.
- [ ] Uji transaksi nyata nominal kecil: order menjadi PAID, entitlement muncul, pengiriman
      terkirim, invoice PDF bisa diunduh, email masuk.
- [ ] Uji webhook ganda: kirim ulang callback → tidak ada pengiriman kedua.
- [ ] Uji signature salah (`curl` dengan signature rusak) → HTTP 401 tercatat.
- [ ] Owner menyetujui prosedur chargeback: order menjadi DISPUTED, panel belum menyediakan
      aksi pemulihan status; eskalasi ke Owner dan jangan mengedit database langsung.
- [ ] Kebijakan tanpa refund sudah ditampilkan di halaman produk, keranjang, checkout, dan
      halaman legal; checkbox persetujuan wajib dicentang.

## 5. Email

- [ ] Domain pengirim punya SPF, DKIM, dan DMARC.
- [ ] Email verifikasi, reset password, dan struk diterima di Gmail + Outlook (bukan spam).
- [ ] `EMAIL_FROM` memakai domain toko, bukan Gmail pribadi.

## 5b. Fitur toko (opsional sebelum rilis)

- [ ] `/admin/pengaturan`: pajak, biaya layanan, batas bayar, usia minimum, dan freeze
      season sudah sesuai keputusan bisnis.
- [ ] Toggle **Hadiah** dinyalakan bila gifting dipublikasikan; uji sekali dengan akun uji
      (keranjang menampilkan "Hadiah untuk X", checkout mengirim ke penerima).
- [ ] Toggle **Ulasan** dinyalakan; kirim satu ulasan uji, setujui di `/admin/ulasan`,
      pastikan tampil di halaman produk dan `/ulasan` dengan nama tersamar; edit sebagai pemilik,
      pastikan ulasan kembali ke antrean moderasi dan hilang dari publik sampai disetujui lagi.
- [ ] Login Discord (bila dipakai): aplikasi Discord dibuat, redirect URI
      `<APP_URL>/api/auth/discord/callback` terdaftar, kredensial diisi, toggle dinyalakan,
      lalu uji tautkan akun dari `/dashboard/keamanan` dan login ulang dengan Discord.

## 6. Server Minecraft & plugin

- [ ] `cd plugin && gradle test build` sukses (JDK 21 + Gradle 8.10).
- [ ] JAR terpasang di `plugins/`; `config.yml` berisi URL website HTTPS, secret, dan polling interval/batch.
- [ ] Log server menampilkan "Delivery polling HTTPS aktif" dan tidak ada error TLS/HMAC.
- [ ] `/admin/server` → status plugin menunjukkan check-in kurang dari 60 detik. Uji RCON untuk kit bila dipakai; RCON tidak mendukung perubahan rank.
- [ ] Pastikan hosting Minecraft tidak perlu membuka port HTTP inbound untuk website.
- [ ] Uji webhook pembayaran rank pada staging: webhook memverifikasi pembayaran lalu
      mengantrekan delivery; setelah plugin polling, tepat satu perintah
      `lp user <uuid> parent add <vip|mvp|elite|legend>` dijalankan. Uji ACK hilang/retry
      dan rekonsiliasi hasil yang tidak pasti; exactly-once belum terbukti. Uji pemain offline, upgrade (group rank
      lama dicabut, group baru dipasang), dan REVOKE `parent remove` untuk group rank saat akhir season.
      Pengaturan group/inheritance sebenarnya tetap harus diperiksa agar group staf tidak berubah.
- [ ] Uji pembelian kit di staging: pembayaran sukses memberi permission tepat pada pemain
      penerima; PlayerKits mengenali permission tersebut dan bisa mengklaim isi kit yang
      disetujui di halaman produk.
- [ ] Verifikasi langsung di PlayerKits bahwa cooldown klaim **5 jam** berlaku di dalam
      game; checkout tetap tidak memakai cooldown repurchase dan pembelian dibatasi satu kali
      per pemain per season.
- [ ] Di akhir season uji transisi pada staging: job REVOKE berjalan dan kedua permission
      kit benar-benar hilang dari pemain (bukan hanya entitlement web yang nonaktif).
- [ ] Uji pemain offline: pembelian tetap tercatat. Rank maupun kit hanya diproses setelah login LoginSecurity dan lease website berikutnya (biasanya sekitar satu menit atau lebih), saat pemain tetap online. Periksa penahanan UUID yang didaftarkan saat pemain offline, antrean lokal yang tertinggal dan rekonsiliasinya.
- [ ] Uji `/verify KODE`: akun Minecraft terhubung ke dashboard.

## 7. Worker & job terjadwal

- [ ] Service `worker` berjalan (`docker compose ps`), log `worker_started`.
- [ ] Job `order.expire` menandai order PENDING yang lewat batas waktu menjadi EXPIRED.
- [ ] Reminder season 7 hari & 1 hari terkirim (uji dengan menggeser tanggal season).
- [ ] `POST /api/cron` dengan header `Authorization: Bearer <CRON_SECRET>` mengembalikan 200.

## 8. Keamanan

- [ ] Semua halaman memakai HTTPS; HSTS aktif (`curl -I https://<domain>`).
- [ ] Header `Content-Security-Policy`, `X-Frame-Options: DENY`, `nosniff` terpasang.
- [ ] Login dengan password salah 5× terkunci sementara; pesan error generik.
- [ ] 2FA aktif untuk semua akun staf (panel `/admin/staf` menunjukkan "Aktif").
- [ ] `/admin` dan `/dashboard` tidak bisa diakses tanpa sesi.
- [ ] Rate limit login/checkout/webhook bekerja (uji dengan banyak request).
- [ ] Hak redistribusi/komersial sprite Minecraft ditinjau terhadap Usage Guidelines oleh
      pemilik/penasihat hukum; bila tidak jelas atau tidak diizinkan, ganti dengan aset yang
      lisensi komersialnya eksplisit sebelum go-live. Lisensi MIT repo sumber tidak mencakup
      sprite Mojang/Microsoft (`ASSETS.md`).
- [ ] Tidak ada kredensial di repo (`git log -p | grep -i secret` bersih).

## 9. Kualitas

- [ ] `npm run typecheck` bersih.
- [ ] `npm test` hijau (unit + integrasi).
- [ ] `npm run test:e2e` hijau.
- [ ] Lighthouse (mobile) beranda & halaman produk: Performance ≥ 90, Accessibility ≥ 90,
      Best Practices ≥ 90, SEO ≥ 90.
- [ ] Uji di lebar 360, 768, 1280, 1536 px tanpa scroll horizontal.
- [ ] `prefers-reduced-motion` mematikan animasi.

## 10. Operasional

- [ ] Backup database terjadwal + uji restore berhasil di lingkungan terpisah.
- [ ] Monitoring uptime untuk `/api/health` dan `/` (interval 1 menit).
- [ ] Alert staf tersambung (email/Discord) untuk kegagalan pembayaran dan pengiriman.
- [ ] `docs/RUNBOOK.md` dibaca oleh minimal dua orang staf.
- [ ] Kontak bantuan (`site.supportEmail`) aktif dan dipantau.
- [ ] Pengumuman peluncuran dicek ulang: tidak ada klaim palsu atau angka fiktif.

## Setelah rilis

- Pantau `/admin/pengiriman` selama 24 jam pertama; rekonsiliasi setiap `DEAD` atau hasil tidak pasti di game sebelum mempertimbangkan kirim ulang. Jangan retry massal.
- Catat tanggal peluncuran dan versi commit di catatan rilis.

### Rekonsiliasi sebelum aktivasi pengiriman

- [ ] Periksa delivery lama yang di-ACK sebagai antrean offline tetapi tercatat selesai; cek pemain dan marker plugin sebelum tindakan manual. Jangan mengirim ulang seluruhnya tanpa pemeriksaan.
- [ ] Uji callback tanpa nominal, referensi tidak cocok, event terputus dan pembayaran terlambat di sandbox gateway. Konflik kuota kupon diperingatkan ke staf, tetapi harga yang diterima tetap dihormati dan kuota bisa terlampaui; sepakati kebijakan penanganan dana sebelum memakai kuota sebagai batas absolut.
- [ ] Uji plugin online/offline, crash dan perintah sebagian pada server staging. ACK antrean offline kini belum dinyatakan selesai, tetapi exactly-once belum dijamin.

### Bantuan dan riwayat hadiah
Jalankan seluruh migrasi termasuk `0017` sebelum deploy. Bantuan dan percakapan tersimpan di PostgreSQL; staf perlu izin `orders.read` dan MFA. Feed operasional staf adalah 50 notifikasi terbaru yang disaring izin, bukan sistem penugasan atau konfirmasi penyelesaian. Riwayat bantuan, hadiah dan pesanan menggunakan paginasi; pemilihan pesanan di formulir bantuan menampilkan 100 terbaru serta pesanan milik sendiri yang dibuka dari detail. Lindungi data percakapan sesuai kebijakan retensi/privasi dan atur Redis untuk pembatasan laju bersama antar instance. Validasi alur dengan akun dan server staging sesungguhnya sebelum produksi. Snapshot grup dan cooldown sudah disiapkan tetapi dinonaktifkan secara default dan belum divalidasi pada server nyata; catatan toko tetap ditampilkan terpisah.

Tes browser `tests/e2e/auth-support.spec.ts` memeriksa login biasa, isolasi bantuan, dan 2FA staf. Jalankan hanya dengan database khusus tes dan `E2E_ALLOW_DB_FIXTURES=1`; CI menyiapkan database tersendiri. Keberhasilan lokal tidak membuktikan login pada preview iframe lintas situs atau layanan produksi.

### Target Paper 26.1.2 dan status pemain (perlu validasi staging)
Pemilik mengonfirmasi **Paper 26.1.2 build 74** dan **PlayerKits 2 1.23.1**. Target default plugin companion tetap Paper 1.21.4/Java 21; opsi build `gradle build -PpaperTarget=26.1.2` memakai Paper API `26.1.2.build.74-stable`, Java 25 dan Gradle 9.2.1. CI dikonfigurasi untuk kedua target dan memisahkan artefaknya, tetapi job/artefak belum diverifikasi. Jangan memasang JAR hanya berdasarkan keberhasilan kompilasi: uji seluruh plugin pada staging terlebih dahulu.

- Terapkan seluruh migrasi sampai `0017` (snapshot ditambahkan oleh `0013`). `polling.enabled` harus aktif; `live-status.enabled` default **false** dan hanya diaktifkan setelah uji staging. Pemilik mengonfirmasi nama kit `cipiprime` dan `cipi++`; keduanya menjadi default `live-status.kit-names` (maksimal lima). Instalasi lama dengan `config.yml` yang sudah ada perlu menambahkan bagian `live-status` secara manual; `saveDefaultConfig()` tidak menimpa file lama. Restart server/plugin setelah mengubah bagian ini: `/cipistore reload` tidak membangun ulang poller. Pastikan nama kit dan hasil cooldown benar di staging.
- Companion membaca grup utama LuckPerms dan teks cooldown PlayerKits2 1.23.1 untuk maksimal 50 pemain online per polling, bergilir jika lebih banyak. API mengembalikan teks terlokalisasi, bukan durasi; tidak ada hitung mundur di website. Cooldown akan kosong jika versi plugin berbeda, kit tidak ada, atau data PlayerKits2 belum dimuat. Nama grup utama bukan jaminan permission efektif atau kelayakan klaim kit.
- Permintaan HMAC menyertakan UUID serta snapshot pemain online; website hanya menyimpan untuk profil terverifikasi yang terhubung dan menampilkan hanya kepada pemilik. Hanya satu snapshot terakhir per profil disimpan; snapshot lama tetap di database sampai ditimpa atau profil dihapus, tetapi tidak ditampilkan setelah 90 detik. Pengamatan terbaru bukan jaminan pemain masih online sekarang. Catat penggunaan data dan tetapkan kebijakan retensi sebelum produksi.
- Uji clock kedua server sinkron; HMAC, replay, akun lain, unlink/relink, pemain online/offline, pemain baru, cooldown dan format bahasa, permission sebenarnya, versi plugin, LuckPerms, Java/Floodgate dan restart. Snapshot tidak memengaruhi pengiriman atau entitlement. Pengujian lokal saat ini belum membuktikan kompatibilitas runtime ataupun integrasi di server nyata.

### Pengamanan pengiriman terbaru — wajib diuji di staging
Plugin menyimpan intent sebelum eksekusi dan menahan hasil yang tidak pasti untuk pemeriksaan manual; marker selesai digunakan untuk ACK ulang. RCON hanya untuk perintah kit yang diizinkan; rank melalui RCON ditahan. RCON memakai claim atomik dan kegagalan dihentikan untuk pemeriksaan, sedangkan `SENT` RCON yang tertahan tidak otomatis diulang. Riwayat plugin/RCON yang mungkin sudah dijalankan tidak otomatis berpindah metode. Periksa [`RUNBOOK.md`](RUNBOOK.md) sebelum mengulang, berganti metode, atau memulihkan backup. Simpan folder antrean **dan** `delivery-intents/` pada storage persisten, pantau kapasitas, dan uji dukungan fsync. Perubahan ini mengurangi risiko duplikasi tetapi tidak membuktikan exactly-once, terutama saat crash, restore lama, beberapa server atau plugin lama; JAR versi ini belum diverifikasi pada Paper nyata.

### Cakupan kupon dan diskon otomatis
Migrasi `0015` menambahkan pilihan cakupan potongan di formulir admin. Aturan yang sudah ada tetap menghitung potongan dari seluruh keranjang; owner dapat memilih hanya jenis yang dipilih saat membuat atau mengubah promo. Minimum belanja dan tingkat kupon memakai subtotal seluruh keranjang; tanpa pembatasan jenis, kedua pilihan sama. Diskon terbesar tetap dipilih dan kupon menang jika sama. Uji di staging sebelum memakai promo; tidak ada promo produksi yang diubah atau diaktifkan oleh migrasi ini.

### Pengaman perintah pengiriman (wajib diperiksa sebelum rilis)

- Website dan plugin versi baru membatasi perintah ke LuckPerms parent add/remove untuk grup `vip`, `mvp`, `elite`, `legend`, dan permission `playerkits.kits.cipiprime` / `playerkits.kits.cipi++` (set true atau unset), dengan target penerima yang cocok. `parent set` dan perintah arbitrer ditahan. Checkout menolak template GRANT kosong/tidak aman dan REVOKE upgrade kosong/tidak aman; perubahan template setelah checkout tetap bisa menyebabkan pengiriman tertahan dan perlu rekonsiliasi pembayaran.
- Username Bedrock dengan spasi tidak dapat dipakai sebagai satu argumen perintah; gunakan `{uuid}` dalam template yang valid, dan uji UUID Floodgate di staging. Perintah kustom lain tidak lagi dikirim otomatis tanpa perubahan kode yang direview.
- Sebelum mengganti versi, **hentikan polling dan pengiriman plugin lama**; queue offline di plugin lama tidak memiliki pengaman versi baru. Backup dan periksa queue serta delivery `QUEUED`, `SENT`, `FAILED`, `DEAD` secara manual; jangan hapus atau kirim ulang sebelum memeriksa apakah sudah dijalankan.
- Nama grup yang diizinkan bukan bukti konfigurasi LuckPerms aman. Periksa keempat grup, seluruh inheritance/weight dan grup staf pada server staging. Perubahan API gagal tidak otomatis diteruskan ke konsol pada plugin baru. Identitas akun alternatif staf yang tidak terdaftar masih belum dapat diketahui; penjualan rank harus tetap ditunda sampai kebijakan identitas teruji.
- Tes Java stub bukan JAR Paper terverifikasi. Bangun dengan CI/Gradle dan uji di server Paper/LuckPerms/PlayerKits2/Floodgate nyata sebelum pemasangan. Tidak ada jaminan tepat sekali saat crash.
- Setelah rilis yang teruji, perubahan rank hanya lewat plugin dengan API LuckPerms; **RCON tidak dapat menjalankan grant/revoke rank**. Website menolak checkout rank otomatis jika server default bukan mode plugin. Pastikan versi plugin yang benar benar-benar terpasang: pilihan mode plugin saja tidak membuktikannya. Grup staf yang dijaga dalam kode: owner, co-owner, manager, sr-admin, admin, sr-moderator, moderator, helper, trainee; setiap perubahan nama grup memerlukan review dan pembaruan kode.
- `freerank` khusus event dan berada di luar otomatisasi toko: jangan menambah, mencabut, atau menggantinya saat grant, upgrade, comp, revoke, atau transisi season. Uji pemain yang memiliki group ini di staging; jangan menganggap perlindungan berlaku untuk plugin lama atau sistem lain.
- Migrasi `0017` menyediakan daftar UUID Minecraft utama/alternatif staf di `/admin/staf` untuk Owner; daftar dimulai kosong. Owner wajib memverifikasi UUID Java/Floodgate, menambahkan setiap akun yang diketahui, dan mencatat alasan. Tidak ada pendeteksian otomatis untuk akun alternatif yang tidak terdaftar. Pembatasan daftar terkait role staf website; ketika role menjadi CUSTOMER daftar terkait tidak aktif dan aktif kembali jika staf dipulihkan. Periksa konflik antrean lama dan role LuckPerms sebelum perubahan. Jangan gunakan akun/staf nyata di staging.

### Identitas offline dan LoginSecurity (belum siap produksi)

- Gunakan migrasi sampai `0019`, companion protokol 2 dan `MINECRAFT_LOOKUP_MODE=offline` hanya di staging dulu. Companion mewajibkan sesi LoginSecurity terdaftar dan terautentikasi untuk `/verify` dan eksekusi; Floodgate menentukan edisi, bukan versi UUID. Bedrock perlu prefiks titik sesuai konfigurasi Floodgate situs. Bypass LoginSecurity tanpa password tidak cukup. Verifikasi membutuhkan nama yang cocok dan UUID aktual ditandatangani plugin; profil lama harus diverifikasi ulang. Konflik UUID/nama lama memerlukan investigasi staf, bukan penimpaan otomatis.
- Poll lama atau tanpa LoginSecurity/Floodgate yang siap tidak menerima lease. Checkout/comp mode offline juga memerlukan check-in protokol 2 yang baru (maksimal 120 detik). Ini pemeriksaan struktural, bukan bukti konfigurasi atau kesehatan sebenarnya, dan tidak mencegah plugin berhenti setelah check-in. RCON ditahan untuk seluruh delivery di mode offline. Pastikan satu server default, rahasia HMAC kuat dan tersimpan aman, akses jaringan Minecraft dibatasi agar pemain tak dapat mem-bypass LoginSecurity/Floodgate, dan semua jalur command eksternal diaudit.
- Migrasi `0018` hanya memperbarui pasangan template rank/kit bawaan yang sama persis menjadi target `{uuid}`; template kustom dan perintah yang sudah tersalin ke delivery/queue tidak berubah. Cek dan rekonsiliasi manual antrean lama, terutama status `SENT`, marker intent/selesai, UUID Mojang versus offline, profil dan entitlement. Delivery tanpa profil v2 tertahan; jangan mass-retry atau menyalin UUID dengan tebakan. Perubahan nama/kapitalisasi pada server offline dapat mengubah UUID; perpindahan kepemilikan tidak otomatis.
- Matikan checkout dan plugin lama, backup database + antrean + `delivery-intents`, lalu uji upgrade di staging yang terisolasi dengan versi Paper, LoginSecurity, Floodgate, Geyser, LuckPerms dan PlayerKits yang benar. Uji Java/Bedrock sebelum dan setelah login, salah password, bypass, logout/reconnect, plugin hilang, restart, hadiah, comp, revoke, staf dan alternatif terdaftar, serta crash/timeout. Pastikan server juga mencegah spoofing koneksi Floodgate dan bahwa sesi LoginSecurity sesuai kebijakan server.
- Cakupan larangan rank untuk akun alternatif bergantung pada registry lengkap yang diverifikasi manusia; sistem tidak bisa mengetahui alternatif yang belum terdaftar. Perlindungan ini tidak menutup semua race atau akses plugin/operator lain, dan exactly-once belum terbukti. Seed tidak lagi membuat kupon contoh; promosi lama tidak dinonaktifkan atau diubah otomatis. Tidak ada data produksi atau akun staf yang dibuat otomatis.
