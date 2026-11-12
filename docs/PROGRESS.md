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
npm test                          # 116 unit; 36 integrasi di-skip tanpa database
TEST_DATABASE_URL=... npm test    # 152 test (116 unit + 36 integrasi)
npm run test:e2e                  # Playwright smoke (butuh browser)
```

Integration: validasi & idempotensi webhook, pembuatan order server-side (no-refund,
snapshot legal, upgrade selisih, blokir rank dimiliki, hadiah ke UUID penerima, validasi metode
pembayaran), ulasan pembeli (kelayakan, edit oleh pemilik, moderasi, dan feed publik), kupon,
serta katalog rank (harga/tier/group webhook dan urutan tampilan), polling plugin (nonce,
claim/lease, ACK idempoten dan retry), cakupan data admin, dan pencabutan entitlement dengan
izin/template/audit.

## Log

### Langkah 0 — Arsitektur
- Stack final ditetapkan; 3 penyimpangan didokumentasikan (Drizzle, auth mandiri, antrean
  Postgres menggantikan Prisma/Auth.js/BullMQ).

### Langkah 1 — Fondasi
- Skema database lengkap, migrasi SQL versioned, seed idempoten (Season 1, 4 rank, 2 kit,
  template perintah LuckPerms/PlayerKits dan owner dari env; promosi tidak dibuat otomatis).
- Token desain + komponen dasar + 40 sprite item Minecraft self-hosted + logo CipiSMP.
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
- Plugin Paper (Java 21, Gradle): polling HTTPS keluar dengan HMAC + timestamp + nonce,
  claim lease `SKIP LOCKED`, ACK idempoten dan retry; antrean offline persisten,
  LuckPerms API, `/verify`, `/cipistore queue|flush|reload`. Tidak ada port HTTP inbound.

### Langkah 6 — Dashboard pemain
- Ringkasan (rank aktif, pesanan terakhir, akun Minecraft), daftar & detail pesanan,
  hubungkan akun Minecraft (kode in-game), keamanan akun (ganti password/email, 2FA,
  daftar sesi + revoke, hapus akun).

### Langkah 7 — Panel admin
- Ringkasan (pendapatan, order menunggu, pengiriman bermasalah, comp manual), pesanan +
  detail (tandai lunas manual, batal, catatan, kirim ulang), monitor pengiriman, produk
  (CRUD + soft delete; harga/tier/artwork/warna/perks/perintah/isi kit), season (CRUD + pratinjau/simulasi/eksekusi transisi), pelanggan,
  kupon, pembayaran (metode Admin; kesiapan/kredensial dan diagnostik webhook Owner-only), server & plugin (uji koneksi),
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
  (star/milk/pop/cute/amber). Pratinjau tautan di Discord/WhatsApp kini menampilkan produk,
  bukan hanya banner toko.

- **Penyempurnaan pasca-Wave 2**: rating bintang tampil di kartu katalog (`/`, `/rank`,
  `/kit`), admin diberi notifikasi `SYSTEM` + banner jumlah ulasan menunggu moderasi di
  Ringkasan, detail pesanan admin menampilkan asal hadiah, dan `/admin/pengaturan` kini juga
  mengatur identitas situs (nama, tagline, email bantuan, Discord, banner pengumuman) serta
  parameter pengiriman.

## Status working tree terkini — 11 November 2026

Migrasi `0000`–`0011`, 130 tes unit, 60 tes integrasi dan build web lulus di sandbox. Hasil ini bukan hasil CI commit rilis. Plugin Java, layanan eksternal dan alur login preview tertanam masih perlu verifikasi; lihat `plan.md` untuk risiko dan pekerjaan terbuka. Halaman akun staf kini di `/admin/profil` dan `/admin/keamanan`; halaman pelanggan tetap di `/dashboard`.

## Verifikasi Group B — 11 November 2026 (historis; cek run rilis)

Workflow CI dikonfigurasi untuk build/typecheck/unit+integration, Docker Compose/image, plugin
Paper (JDK 21 + Gradle + JUnit) dan tes Playwright; hasil dan artifact commit rilis belum diverifikasi dalam sesi ini. Tes kontrak tanpa kredensial live
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
- [x] Tujuh ilustrasi raster unik untuk empat rank aktif (Star Cipi, Milk Cipi, Pop Cipi, Cute Cipi) dan tiga rank arsip; kit memakai sprite item aktual.

## Release-readiness pass — 11 November 2026

- [x] Audit izin halaman admin dan aksi tulis. Ringkasan hanya mengambil data pengiriman untuk
  `delivery.read`; rincian pembayaran/webhook dan uji kesiapan provider memerlukan izin Owner
  `payments.secrets`; kontrol mutasi memakai izin masing-masing. Query admin dibatasi di server
  page, bukan diekspos sebagai server action baca. Detail order memakai proyeksi khusus dan tidak
  mengambil respons gateway mentah, URL checkout/kode bayar, IP/UA, metadata item penuh, atau perintah
  delivery.
- [x] Daftar pelanggan mengecualikan staf; CSV hanya memuat email, username, tanggal daftar,
  dan total order berbayar yang tertaut ke akun (tanpa status auth/aktivitas login). Pembelian
  tamu dengan email sama tidak dihitung sebagai order akun. Detail akun menampilkan profil
  Minecraft, order, dan entitlement sesuai izin. Pencabutan entitlement mencatat alasan serta
  mengantrekan template REVOKE bila tersedia.
- [x] Ekspor admin menolak jenis ekspor dan tanggal invalid, mem-parse tanggal WIB tanpa
  normalisasi kalender, serta menolak filter tanggal yang tidak didukung untuk CSV pelanggan.
- [x] Verifikasi migrasi penuh pada PostgreSQL disposable baru: `0000`–`0009` berhasil;
  urutan katalog Cute/Pop/Milk/Star beserta harga/tier Rp10.000/1, Rp30.000/2, Rp60.000/3,
  Rp100.000/4 terverifikasi, begitu pula `plugin_last_seen_at`, `plugin_version`, dan `lease_token`.
  Database uji dihapus setelah verifikasi.
- [x] Database lokal preview yang sebelumnya sampai `0007` telah menerapkan `0008`–`0009`;
  empat rank tayang kini memakai harga yang disetujui. Database production tidak diubah.
- [x] `npx drizzle-kit check`, `npm run typecheck`, `git diff --check`, `npm run build`, dan
  `npm test` pada database disposable hasil migrasi: **152/152 tes lulus** (116 unit + 36 integrasi).
  Smoke test `npm start`: `/api/health`, `/`, dan `/rank` merespons HTTP 200.
- [ ] Playwright E2E: perintah berhasil menyalakan server standalone, tetapi 10 tes terhenti
  sebelum assertion karena Chromium tidak terpasang di sandbox. Jalankan kembali di runner
  dengan browser terpasang.
- [ ] Plugin Java belum dikompilasi/dites: JDK 21 dan Gradle tidak tersedia di sandbox, dan
  repo tidak punya Gradle Wrapper. Jalankan `cd plugin && gradle test build` di runner ber-toolchain.
  Tambahkan tes antrean offline untuk kegagalan penulisan marker selesai dan pemulihan saat login.
- [ ] Uji k6 dan build/validasi Docker belum dilakukan lokal karena `k6` dan Docker tidak tersedia.
- [ ] Sebelum deploy, cocokkan journal/schema/data database production pada backup terisolasi
  untuk migrasi `0000`–`0009`; bila ada pembeli rank lama, sinkronkan group aktif mereka di
  LuckPerms sebelum mengganti command.
- [ ] Uji end-to-end di staging: webhook rank dan ACK/retry tanpa duplikasi, upgrade/REVOKE,
  antrean offline, permission PlayerKits, serta fallback RCON pada server Minecraft nyata.
- [ ] Uji provider live (Tripay/Midtrans, email, Discord OAuth, Turnstile) memakai akun/domain
  staging; pengujian lokal hanya memakai database disposable dan mock untuk provider.
- [ ] Lengkapi kesiapan production: backup/restore, TLS/domain, secrets, worker/cron, monitoring,
  alert, Lighthouse/responsive/reduced-motion, dan tinjauan hukum syarat/privasi serta hak
  redistribusi komersial aset Minecraft (`ASSETS.md`).
