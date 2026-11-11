# CipiSMP Store

Toko resmi untuk server Minecraft **CipiSMP**: menjual rank dan kit yang berlaku selama
satu season, dengan pembayaran QRIS/e-wallet lewat Tripay atau Midtrans, pengiriman otomatis
ke server lewat plugin Paper (fallback RCON), dan panel admin lengkap.

- **Tanpa langganan, tanpa perpanjangan, tanpa refund.** Rank/kit aktif sampai season berakhir.
- **Uang selalu integer rupiah**, waktu selalu `Asia/Jakarta`, UI berbahasa Indonesia.
- **Identitas pembeli = UUID Minecraft** (Floodgate UUID untuk Bedrock). Username hanya tampilan.

## Stack

| Lapisan | Pilihan |
| --- | --- |
| Web | Next.js 15 App Router, TypeScript strict, React 19, Tailwind CSS |
| Data | PostgreSQL 16 + Drizzle ORM (migrasi SQL versioned) |
| Auth | Sesi sendiri (cookie httpOnly), argon2id, TOTP 2FA, Turnstile opsional |
| Antrean | Tabel `jobs` PostgreSQL (`FOR UPDATE SKIP LOCKED`) + worker terpisah |
| Pembayaran | Adapter Tripay / Midtrans / Fake (dev) dengan verifikasi signature |
| Pengiriman | Plugin Paper `plugin/` (HMAC + nonce), fallback RCON |
| Uji | Vitest (unit + integrasi), Playwright (e2e), k6 (beban, opsional) |

Penyimpangan dari brief (Prisma → Drizzle, Auth.js → auth mandiri, BullMQ → antrean
Postgres, Redis opsional) beserta alasannya ada di [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md).

## Menjalankan dengan Docker

```bash
cp .env.example .env      # isi minimal: APP_URL, DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY
openssl rand -base64 48   # -> SESSION_SECRET
openssl rand -base64 32   # -> ENCRYPTION_KEY

docker compose up -d --build      # db, redis, migrate, web, worker
docker compose run --rm seed      # season 1, produk, akun owner dari env
open http://localhost:3000        # login: SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD
```

`docker compose down` menghentikan semua layanan; data tetap di volume `db-data`.
Untuk menghapus data: `docker compose down -v`.

## Menjalankan lokal (tanpa Docker)

```bash
npm install
# PostgreSQL 16 harus jalan; DATABASE_URL di .env
npm run db:migrate
npm run db:seed
npm run dev          # http://localhost:3000
npm run worker        # terminal lain: email, pengiriman, kedaluwarsa order, reminder season
```

## Variabel `.env` yang wajib benar

| Variabel | Keterangan |
| --- | --- |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | URL publik toko, dipakai untuk link email, webhook, dan cookie |
| `DATABASE_URL` | Koneksi PostgreSQL |
| `SESSION_SECRET` | ≥ 32 karakter acak, dipakai juga untuk signature provider Fake |
| `ENCRYPTION_KEY` | base64 32 byte untuk mengenkripsi kredensial gateway di database |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD` | akun Owner pertama |
| `EMAIL_PROVIDER` | `resend`, `smtp`, atau `outbox` (dev, email ditulis ke log) |
| `PLUGIN_SHARED_SECRET` | ≥ 16 karakter, harus sama dengan `config.yml` plugin |
| `CRON_SECRET` | pengaman endpoint `POST /api/cron` |

Opsional: `REDIS_URL` (rate limit lintas instance), `TRIPAY_*`, `MIDTRANS_*`,
`TURNSTILE_*`, `SENTRY_DSN`, `ARGON2_MEMORY_KIB`, `DELIVERY_RETRY_BASE_SECONDS`,
`WORKER_TICK_MS`, `SESSION_IDLE_MINUTES`, `SESSION_ABSOLUTE_HOURS`, `SESSION_REMEMBER_DAYS`.

Daftar lengkap + komentar: [`.env.example`](.env.example). Aplikasi menolak start bila
variabel wajib hilang atau tidak valid (fail fast saat boot).

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` / `npm start` | Build & jalankan produksi |
| `npm run worker` | Worker job (email, pengiriman, kedaluwarsa, reminder) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit + integrasi (integrasi di-skip tanpa `TEST_DATABASE_URL`) |
| `npm run test:unit` / `npm run test:integration` | Per kelompok |
| `npm run test:e2e` | Playwright (butuh server produksi/`E2E_BASE_URL`) |
| `npm run db:generate` / `npm run db:migrate` | Migrasi Drizzle |
| `npm run db:seed` | Seed idempoten (season, produk, template perintah, owner) |

## Struktur singkat

```
src/app (store)   storefront, keranjang, checkout, pesanan publik, legal
src/app/dashboard dashboard pemain
src/app/admin     panel admin (pesanan, produk, season, kupon, pembayaran, server, staf, audit)
src/app/actions   server actions (auth, akun, keranjang, checkout, admin)
src/server        domain: pricing, orders, payments, delivery, seasons, auth, jobs
plugin/           plugin Paper (Gradle, Java 17)
drizzle/          migrasi SQL
tests/            unit, integrasi, e2e, load
docs/             arsitektur, asumsi, progres, go-live, runbook, panduan admin
```

## Plugin Minecraft

```bash
cd plugin
./gradlew build          # butuh JDK 17 + Gradle
cp build/libs/cipismp-store-companion-1.0.0.jar <server>/plugins/
# isi plugins/CipiStoreCompanion/config.yml: website-url, shared-secret, http.port
```

Plugin mendengarkan `127.0.0.1:8081` secara default, memverifikasi HMAC + timestamp +
nonce, menjalankan perintah lewat LuckPerms (bila ada) atau konsol, dan menyimpan antrean
pemain offline ke disk sampai login berikutnya. Pemain menghubungkan akun dengan
`/verify KODE` dari dashboard.

## Dokumentasi

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — komponen, ERD, alur order, keamanan
- [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) — semua keputusan yang diambil
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — status per langkah
- [`docs/GO_LIVE.md`](docs/GO_LIVE.md) — checklist rilis
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — prosedur operasi & insiden
- [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md) — panduan non-teknis untuk staf
- [`ASSETS.md`](ASSETS.md) — lisensi aset visual & font

## Kebijakan

Semua penjualan final; tidak ada refund, pembatalan setelah bayar, atau pengembalian dana
lewat sistem. Sengketa ditandai `DISPUTED` dan ditangani manual tanpa mengembalikan dana.
Syarat lengkap ada di halaman `/legal/syarat-penjualan`, `/legal/syarat-layanan`, dan
`/legal/kebijakan-privasi`.

CipiSMP Store bukan produk resmi Mojang Studios atau Microsoft. Minecraft adalah merek
dagang Mojang Studios. Kami tidak berafiliasi dengan Mojang maupun Microsoft.
