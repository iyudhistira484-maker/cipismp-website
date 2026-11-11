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
| 7. Dashboard admin | ✅ | 11 halaman: ringkasan, pesanan, pengiriman, produk, season, pelanggan, kupon, pembayaran, server, staf, audit, comp |
| 8. Hardening, CI, go-live | ✅ | Header + CSP, sitemap/robots/OG, Docker Compose, CI, e2e, dokumen |

## Test

```
npm test                     # unit + integrasi yang bisa di-skip
npm run test:unit            # 62 test, tanpa database
TEST_DATABASE_URL=... npm test  # + 5 test integrasi webhook (67 total)
```

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
- Plugin Paper (Java 17, Gradle): endpoint lokal HMAC + timestamp + nonce, antrean
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
- GitHub Actions CI: typecheck + migrasi + unit/integrasi + build, lalu Playwright smoke.
- Playwright e2e (storefront, auth, admin gate) dan skrip k6 untuk uji beban katalog.
- Dokumen: `README.md`, `ASSETS.md`, `GO_LIVE.md`, `RUNBOOK.md`, `ADMIN_GUIDE.md`.

## Berikutnya (di luar MVP — Wave 2, menunggu keputusan)
1. Gifting UI (mesin harga sudah mendukung aturan rank terhadap UUID penerima).
2. Login Discord, ulasan pembeli, kupon bertingkat.
3. Halaman admin lanjutan: ekspor CSV, grafik tren, manajemen sesi staf.
4. Aset gambar/OG per produk.
