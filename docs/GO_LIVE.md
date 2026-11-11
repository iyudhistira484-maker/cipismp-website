# Checklist go-live

Dokumen ini dipakai sekali saat pertama kali merilis toko ke produksi, lalu disimpan
sebagai catatan audit. Centang setiap baris; jangan meluncurkan sebelum semuanya hijau.

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
- [ ] `PLUGIN_SHARED_SECRET` ≥ 16 karakter dan **sama** dengan `config.yml` plugin.
- [ ] `CRON_SECRET` ≥ 16 karakter.
- [ ] `EMAIL_PROVIDER=resend` atau `smtp` (bukan `outbox`), kredensial terisi.
- [ ] `MINECRAFT_LOOKUP_MODE=mojang`.
- [ ] `TURNSTILE_ENABLED=1` beserta site/secret key.
- [ ] `PAYMENT_DEFAULT_PROVIDER` sesuai gateway aktif, mode `live` untuk produksi.
- [ ] `SEED_OWNER_*` terisi, password kuat, dan diganti setelah login pertama.

## 3. Database & data awal

- [ ] `docker compose up -d --build` sukses; service `migrate` selesai tanpa error.
- [ ] `docker compose run --rm seed` membuat season, rank, kit, template perintah, owner.
- [ ] Season 1 berstatus **ACTIVE** dengan tanggal selesai yang benar (WIB).
- [ ] Produk sudah `PUBLISHED`, harga sesuai, template GRANT/REVOKE terisi untuk semua produk.
- [ ] Halaman `/rank` dan `/kit` menampilkan nama season + tanggal berakhir.

## 4. Pembayaran

- [ ] Kredensial Tripay/Midtrans diisi di `/admin/pembayaran` dengan mode **live**.
- [ ] URL webhook terdaftar di dashboard gateway:
      `https://<domain>/api/webhooks/tripay` atau `/api/webhooks/midtrans`.
- [ ] Uji transaksi nyata nominal kecil: order menjadi PAID, entitlement muncul, pengiriman
      terkirim, invoice PDF bisa diunduh, email masuk.
- [ ] Uji webhook ganda: kirim ulang callback → tidak ada pengiriman kedua.
- [ ] Uji signature salah (`curl` dengan signature rusak) → HTTP 401 tercatat.
- [ ] Kebijakan tanpa refund sudah ditampilkan di halaman produk, keranjang, checkout, dan
      halaman legal; checkbox persetujuan wajib dicentang.

## 5. Email

- [ ] Domain pengirim punya SPF, DKIM, dan DMARC.
- [ ] Email verifikasi, reset password, dan struk diterima di Gmail + Outlook (bukan spam).
- [ ] `EMAIL_FROM` memakai domain toko, bukan Gmail pribadi.

## 6. Server Minecraft & plugin

- [ ] `cd plugin && ./gradlew build` sukses (JDK 17).
- [ ] JAR terpasang di `plugins/`, `config.yml` berisi URL website + secret + port.
- [ ] Log server menampilkan "CipiSMP Store API mendengarkan di ...".
- [ ] `/admin/server` → "Uji plugin" hijau. "Uji RCON" hijau (bila memakai fallback).
- [ ] Uji pembelian rank: perintah LuckPerms jalan, pemain menerima rank.
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
