# Progres pembangunan

Diperbarui setiap akhir langkah. Status: ✅ selesai · 🚧 sedang dikerjakan · ⏭ berikutnya

## Ringkasan

| Langkah | Status | Catatan |
| --- | --- | --- |
| 0. Arsitektur & asumsi | ✅ | `ARCHITECTURE.md`, `ASSUMPTIONS.md` |
| 1. Setup, DB, seed, design system | ✅ | Skema 28 tabel, seed idempoten, token desain, art original |
| 2. Auth & email | ✅ | Register/login/2FA/reset/verifikasi email + halaman auth split-layout |
| 3. Storefront, keranjang, checkout | ✅ | Beranda, rank, kit, keranjang, checkout, status pesanan publik, invoice PDF |
| 4. Pembayaran | ✅ | Tripay, Midtrans, Fake; webhook tervalidasi + idempoten; rekonsiliasi |
| 5. Pengiriman, plugin & season | ✅ | Plugin Paper (HMAC, antrean offline, LuckPerms), RCON, transisi season |
| 6. Dashboard pemain | ✅ | Ringkasan, pesanan, akun Minecraft, keamanan (password, 2FA, sesi, hapus akun) |
| 7. Dashboard admin | ✅ | 13 halaman: ringkasan, pesanan, pengiriman, produk, season, pelanggan, kupon, pembayaran, pengaturan, ulasan, server, staf, audit, comp |
| 8. Hardening, CI, go-live | ✅ | Header + CSP, sitemap/robots/OG, Docker Compose, CI, e2e, dokumen |

## Test

```
npm test                          # 98 unit; integrasi di-skip tanpa database
TEST_DATABASE_URL=... npm test    # 120 test (98 unit + 22 integrasi)
npm run test:e2e                  # Playwright smoke (butuh browser)
```

Integration: validasi & idempotensi webhook, pembuatan order server-side (no-refund,
snapshot legal, upgrade selisih, blokir rank dimiliki, hadiah ke UUID penerima, validasi metode
pembayaran), ulasan pembeli (kelayakan, edit oleh pemilik, moderasi, dan feed publik), serta kupon.

## Log

### Langkah 0 — Arsitektur
- Stack final ditetapkan; 3 penyimpangan didokumentasikan (Drizzle, auth mandiri, antrean
  Postgres menggantikan Prisma/Auth.js/BullMQ).

### Langkah 1 — Fondasi
- Skema database lengkap, migrasi SQL versioned, seed idempoten (Season 1, 3 rank, 3 kit,
  template perintah LuckPerms/EssentialsX, kupon contoh, owner dari env).
- Token desain + komponen dasar + 22 sprite item original + logo SVG.
- Beranda: hero asimetris, status server live, kartu rank & kit, cara kerja, FAQ.

### Langkah 2 — Auth
- argon2id, HIBP k-anonymity, Turnstile (bisa dimatikan via env), rate limit per IP,
  blokir email disposable, verifikasi email, reset password single-use, sesi + revoke,
  2FA TOTP dengan proteksi replay, alert perangkat baru.
- Halaman: masuk, 2FA, daftar, lupa/reset password, verifikasi email.

### Langkah 3 — Storefront & checkout
- `/rank`, `/kit`, detail produk dengan preview item, pencarian/filter, keranjang,
  checkout (guest + akun), hitung ulang harga server-side, status pesanan publik
  bertoken, invoice PDF, halaman legal, 404/403/error.
- Mesin harga: blokir rank dimiliki, upgrade = selisih, blokir downgrade, satu rank per
  order, limit & cooldown kit, freeze window, aturan kupon, diskon tidak negatif.

### Langkah 4 — Pembayaran
- Adapter Tripay/Midtrans/Fake dengan signature verification dari raw body.
- Webhook idempoten (`payment_events.dedupe_key`), audit payload mentah + header + IP,
  deteksi pembayaran kurang/lebih/ganda/telat, chargeback → DISPUTED + alert staf.
- Rekonsiliasi order PENDING, job kedaluwarsa, email order dibuat/dibayar/gagal.

### Langkah 5 — Pengiriman, plugin & season
- Antrean pengiriman: QUEUED → DELIVERED/FAILED → DEAD, backoff eksponensial, redeliver
  manual, kirim saat pemain login berikutnya, RCON fallback.
- Endpoint `/api/plugin/verify` (HMAC + timestamp + nonce) untuk `/verify KODE` in-game.
- Transisi season transaksional + dry-run, pencabutan entitlement, reminder 7/1 hari.
- Plugin Paper (Java 21, Gradle): endpoint lokal HMAC + timestamp + nonce, antrean
  persisten untuk pemain offline, LuckPerms API, `/verify`, `/cipistore queue|flush|reload`.

### Langkah 6 — Dashboard pemain
- Ringkasan (rank aktif, pesanan terakhir, akun Minecraft), daftar & detail pesanan,
  hubungkan akun Minecraft (kode in-game), keamanan akun (ganti password/email, 2FA,
  daftar sesi + revoke, hapus akun).

### Langkah 7 — Panel admin
- Ringkasan (pendapatan, order menunggu, pengiriman bermasalah, comp manual), pesanan +
  detail (tandai lunas manual, batal, catatan, kirim ulang), monitor pengiriman, produk
  (CRUD + soft delete), season (CRUD + pratinjau/simulasi/eksekusi transisi), pelanggan,
  kupon, pembayaran (kredensial Owner-only, webhook terakhir), server & plugin (uji koneksi),
  staf (role), audit log, matriks izin per role.

### Langkah 8 — Hardening, deploy, dokumen
- CSP nonce per request + header keamanan, middleware gerbang `/dashboard` & `/admin`.
- `robots.txt`, `sitemap.xml`, favicon SVG, OG image, loading state, empty state.
- `Dockerfile` multi-stage (runner/worker/migrate), `docker-compose.yml` (db, redis,
  migrate, web, worker, seed opsional), `.dockerignore`.
- GitHub Actions CI: typecheck + migrasi + unit/integrasi + build, Playwright e2e,
  kompilasi/test plugin Java, validasi Compose, dan build image produksi.
- Playwright e2e (storefront, auth, admin gate) dan skrip k6 untuk uji beban katalog.
- Dokumen: `README.md`, `ASSETS.md`, `GO_LIVE.md`, `RUNBOOK.md`, `ADMIN_GUIDE.md`.

## Wave 2

Dimulai dari **admin lanjutan** (dipilih pengguna).

### Selesai
- **Ekspor CSV** pesanan (rentang 100 hari, filter tanggal lewat query) dan pelanggan,
  dengan escaping RFC 4180, BOM UTF-8, netralisasi formula spreadsheet, audit `data.export`,
  dan rate limit 6 ekspor/menit per akun. Route: `GET /api/admin/export?type=orders|customers`.
- **Grafik tren pendapatan** 30 hari (SVG tanpa dependensi, `role="img"` + tabel angka yang
  bisa dibuka) di halaman Ringkasan.
- **Manajemen sesi staf** di `/admin/staf`: daftar sesi aktif (perangkat, IP, aktivitas
  terakhir, status 2FA) + cabut satu sesi / semua sesi, dengan audit log.

- **Gifting UI** di halaman rank & kit: centang "Belikan untuk pemain lain" → isi username
  penerima (divalidasi ke Mojang), baris keranjang bertanda "Hadiah untuk X", harga/aturan
  rank dihitung terhadap UUID penerima, hadiah untuk diri sendiri ditolak, entitlement
  dikirim hanya ke penerima, dan pembeli tercatat di `order_items.meta` (tampil sebagai
  "hadiah dari X" di halaman pesanan). Fitur bisa dimatikan di `/admin/pengaturan`.
- **Ulasan pembeli terverifikasi**: hanya akun dengan pesanan lunas/terkirim untuk produk
  itu yang bisa mengulas, satu ulasan per produk. Semua ulasan masuk antrean moderasi
  (`/admin/ulasan`: Menunggu / Tampil / Disembunyikan), nama penulis disamarkan, rata-rata
  bintang tampil di halaman produk.
- **Login Discord** (OAuth2 identifikasi): tautkan dari `/dashboard/keamanan`, lalu masuk
  dengan satu klik. Tidak ada penggabungan akun otomatis lewat email; staf wajib 2FA lebih
  dulu sebelum menautkan. Aktif bila `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` terisi dan
  toggle "Login Discord" dinyalakan.
- **Halaman `/admin/pengaturan`**: pajak, biaya, batas bayar, usia minimum, freeze season,
  gateway default, dan toggle fitur (kupon, hadiah, ulasan, login Discord).

- **Aset visual per produk**: setiap detail rank & kit punya gambar OG sendiri
  (`/rank/<slug>/opengraph-image`, `/kit/<slug>/opengraph-image`) berisi nama produk,
  tagline, tiga keunggulan, harga, tanggal berakhir season aktif, dan warna tier
  (iron/gold/diamond/amber). Pratinjau tautan di Discord/WhatsApp kini menampilkan produk,
  bukan hanya banner toko.

- **Penyempurnaan pasca-Wave 2**: rating bintang tampil di kartu katalog (`/`, `/rank`,
  `/kit`), admin diberi notifikasi `SYSTEM` + banner jumlah ulasan menunggu moderasi di
  Ringkasan, detail pesanan admin menampilkan asal hadiah, dan `/admin/pengaturan` kini juga
  mengatur identitas situs (nama, tagline, email bantuan, Discord, banner pengumuman) serta
  parameter pengiriman.

## Verifikasi Group B — 11 November 2026

Automasi CI membuktikan build/typecheck/unit+integration, Docker Compose/image, plugin
Paper (JDK 21 + Gradle + JUnit) dan 10 tes Playwright. Tes kontrak tanpa kredensial live
juga mencakup tanda tangan/status Tripay & Midtrans, kesesuaian HMAC website↔plugin,
Discord OAuth, Resend/SMTP, serta Cloudflare Turnstile. Job khusus mengunggah JAR plugin.

Integrasi eksternal **belum dianggap live-terverifikasi** hanya dari mock/CI: transaksi
Tripay/Midtrans, Discord app/redirect aktual, inbox Resend/SMTP dan Turnstile di domain
publik, serta Paper/LuckPerms/RCON dan `/verify` di server Minecraft nyata tetap wajib
dicentang saat go-live di `docs/GO_LIVE.md`.

### Group A (urutan yang diminta)
- [x] Kupon bertingkat: tier dasar + dua ambang tambahan, tier tertinggi tercapai dipakai;
  kupon opsional dibatasi ke season dan ditegakkan lagi saat preview/checkout.
- [x] Halaman publik `/ulasan` (feed dimoderasi, ringkasan rating, pagination) dan edit ulasan milik sendiri; perubahan kembali ke antrean moderasi.
- [x] UI admin untuk mengelola metode pembayaran QRIS / VA / e-wallet per Tripay/Midtrans; checkout memfilter dan memvalidasi pilihan di server.
- [x] Enam ilustrasi raster unik untuk kartu katalog Iron, Gold, Diamond, Starter, Builder, dan Explorer; aset dioptimalkan lewat `next/image`.
