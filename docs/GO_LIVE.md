# Checklist go-live

Dokumen ini dipakai sekali saat pertama kali merilis toko ke produksi, lalu disimpan
sebagai catatan audit. Centang setiap baris; jangan meluncurkan sebelum semuanya hijau.

### Batas verifikasi otomatis vs. live

GitHub Actions memverifikasi typecheck, migrasi + unit/integration test, build produksi,
10 smoke test Playwright, validasi `docker compose config` + image produksi, serta build
plugin Paper dengan JDK 21/Gradle/JUnit. Tes provider memakai mock jaringan untuk
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
- [ ] `MINECRAFT_LOOKUP_MODE=mojang`.
- [ ] `TURNSTILE_ENABLED=1` beserta site/secret key.
- [ ] Pada staging/domain yang terdaftar, form menerima token Turnstile valid dan menolak
      token kosong/tidak valid; matikan hanya bila environment memang non-produksi.
- [ ] `PAYMENT_DEFAULT_PROVIDER` sesuai gateway aktif, mode `live` untuk produksi.
- [ ] `SEED_OWNER_*` terisi, password kuat, dan diganti setelah login pertama.

## 3. Database & data awal

- [ ] Sebelum migrasi ke database yang sudah berisi data, cocokkan tabel journal Drizzle,
      schema aktual, dan data produksi dengan seluruh migrasi (`0000`–`0009`) pada salinan
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
      template `parent set` setelah migrasi `0008_cipi_rank_catalog.sql`.
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
- [ ] `/admin/server` → status plugin menunjukkan check-in kurang dari 60 detik. Uji RCON bila memakai fallback.
- [ ] Pastikan hosting Minecraft tidak perlu membuka port HTTP inbound untuk website.
- [ ] Uji webhook pembayaran rank pada staging: webhook memverifikasi pembayaran lalu
      mengantrekan delivery; setelah plugin polling, tepat satu perintah
      `lp user <player> parent set <vip|mvp|elite|legend>` dijalankan. Uji ACK hilang/retry
      tanpa eksekusi ganda, pemain offline (queue persisten sampai login), upgrade (group rank
      lama dicabut, group baru dipasang), dan REVOKE ke `default` saat akhir season.
- [ ] Uji pembelian kit di staging: pembayaran sukses memberi permission tepat pada pemain
      penerima; PlayerKits mengenali permission tersebut dan bisa mengklaim isi kit yang
      disetujui di halaman produk.
- [ ] Verifikasi langsung di PlayerKits bahwa cooldown klaim **5 jam** berlaku di dalam
      game; checkout tetap tidak memakai cooldown repurchase dan pembelian dibatasi satu kali
      per pemain per season.
- [ ] Di akhir season uji transisi pada staging: job REVOKE berjalan dan kedua permission
      kit benar-benar hilang dari pemain (bukan hanya entitlement web yang nonaktif).
- [ ] Uji pemain offline: pembelian tetap tercatat, perintah dikirim saat pemain login.
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

- Pantau `/admin/pengiriman` selama 24 jam pertama; kirim ulang otomatis bila ada yang DEAD.
- Catat tanggal peluncuran dan versi commit di catatan rilis.
