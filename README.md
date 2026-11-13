# CipiSMP Store

Toko resmi untuk server Minecraft **CipiSMP**: menjual rank dan kit yang berlaku selama
satu season, dengan pembayaran QRIS/e-wallet lewat Tripay atau Midtrans, pengiriman otomatis
ke server lewat plugin Paper (RCON hanya untuk perintah kit yang diizinkan), dan panel admin lengkap.

- **Tanpa langganan, tanpa perpanjangan, tanpa refund.** Rank/kit aktif sampai season berakhir.
- **Bisa dihadiahkan** ke pemain lain (harga & aturan rank dihitung terhadap penerima).
- **Ulasan hanya dari pembeli terverifikasi**, dimoderasi admin sebelum tampil.
- **Login Discord opsional** di samping email/password, dengan 2FA tetap berjalan.
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
| Pengiriman | Plugin Paper `plugin/` (HMAC + nonce); RCON hanya untuk kit yang diizinkan, bukan rank |
| Uji | Vitest (unit + integrasi), Playwright (e2e), k6 (beban, opsional) |

Penyimpangan dari brief (Prisma → Drizzle, Auth.js → auth mandiri, BullMQ → antrean
Postgres, Redis opsional) beserta alasannya ada di [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md).

## Menjalankan dengan Docker

```bash
cp .env.example .env      # isi APP_URL, DATABASE_URL, POSTGRES_PASSWORD, SESSION_SECRET, ENCRYPTION_KEY
openssl rand -base64 48   # -> SESSION_SECRET
openssl rand -base64 32   # -> ENCRYPTION_KEY

docker compose up -d --build      # db, redis, migrate, web, worker
docker compose run --rm seed      # season 1, produk, akun owner dari env
open http://localhost:3000        # login: SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD
```

Untuk Compose, host database pada `DATABASE_URL` adalah `db`, dan user, database serta
password harus sama dengan `POSTGRES_*`; encode karakter khusus password pada URL. Port
PostgreSQL hanya dibuka ke loopback secara default. Atur `REDIS_URL=redis://redis:6379`
untuk rate limit bersama bila dibutuhkan. Jangan jalankan seed pada database yang berisi
data nyata tanpa review dan backup.

`docker compose down` menghentikan semua layanan; data tetap di volume `db-data`.
`docker compose down -v` **menghapus data database**; jangan gunakan pada data yang harus dipertahankan.

## Menjalankan lokal (tanpa Docker)

Gunakan database terpisah dan atur `APP_ENV=development` di `.env` lokal; sesuaikan
`NODE_ENV`, URL, email, dan layanan untuk pengembangan. Jangan pakai profil ini di produksi.

```bash
npm install
# PostgreSQL 16 harus jalan; DATABASE_URL di .env
npm run db:migrate
npm run db:seed
npm run dev          # http://localhost:3000
npm run worker        # terminal lain: email, pengiriman, kedaluwarsa order, reminder season
```

## Preview GitHub Codespaces

Codespaces hanya untuk pengembangan terisolasi, bukan produksi. Pakai database dan
akun uji terpisah, biarkan port web **Private**, dan gunakan URL HTTPS port 3000
Codespaces yang sama persis sebagai `APP_URL`. Set `APP_ENV=development`; Codespaces
menyediakan `CODESPACES=true`, `CODESPACE_NAME` dan domain forwarding otomatis.

Proxy Codespaces dapat menulis ulang `Origin` menjadi `localhost:3000`. Pengecualian
khusus preview hanya aktif pada profil tersebut dengan URL Codespace yang cocok;
semua mutasi browser tetap mensyaratkan forwarded host yang tepat dan
`Sec-Fetch-Site: same-origin`. Browser yang tidak mengirim Fetch Metadata akan ditolak
untuk mutasi dalam preview ini. Di luar Codespaces atau pada production tidak ada
pengecualian. Pemeriksaan API non-browser tidak diubah; webhook dan plugin tetap
menggunakan validasi yang tersedia. Jangan gunakan profil preview atau kredensial uji untuk transaksi nyata.

## Variabel `.env` yang wajib benar

| Variabel | Keterangan |
| --- | --- |
| `APP_ENV` | Wajib eksplisit saat `NODE_ENV=production`; gunakan `production` untuk layanan publik, `development`/`staging` hanya untuk lingkungan terisolasi |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | URL publik toko, dipakai untuk link email, webhook, dan redirect login; gunakan satu domain kanonis yang sama dengan origin browser |
| `PREVIEW_PARTITIONED_COOKIES` | Khusus dev preview HTTPS dalam iframe lintas situs: set `1` agar sesi memakai cookie `Secure; SameSite=None; Partitioned`. Jangan aktifkan untuk deployment normal; tidak berpengaruh pada production. Sebagian lingkungan preview dapat tetap memblokir cookie tertanam; akses tab terpisah juga bisa memerlukan otorisasi preview. |
| `DATABASE_URL` | Koneksi PostgreSQL |
| `SESSION_SECRET` | ≥ 32 karakter acak, dipakai juga untuk signature provider Fake |
| `ENCRYPTION_KEY` | base64 32 byte untuk mengenkripsi kredensial gateway di database |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD` | akun Owner pertama |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | opsional; login Discord (redirect URI `<APP_URL>/api/auth/discord/callback`) |
| `EMAIL_PROVIDER` | `resend`, `smtp`, atau `outbox` (dev, email ditulis ke log) |
| `PLUGIN_SHARED_SECRET` | ≥ 16 karakter acak, sama dengan `shared-secret` plugin; dipakai untuk HMAC polling HTTPS dan `/verify` |
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
| `npm run test:e2e` | Playwright (butuh `npm run build` + Chromium; server standalone dimulai otomatis) |
| `npm run db:generate` / `npm run db:migrate` | Migrasi Drizzle |
| `npm run db:seed` | Seed idempoten (season, produk, template perintah, owner) |

## Struktur singkat

```
src/app (store)   storefront, keranjang, checkout, pesanan publik, legal
src/app/dashboard dashboard pemain
src/app/admin     panel admin (pesanan, produk, season, kupon, pembayaran, server, staf, audit)
src/app/actions   server actions (auth, akun, keranjang, checkout, admin)
src/server        domain: pricing, orders, payments, delivery, seasons, auth, jobs
plugin/           plugin Paper (Gradle, Java 21)
drizzle/          migrasi SQL
tests/            unit, integrasi, e2e, load
docs/             arsitektur, asumsi, progres, go-live, runbook, panduan admin
```

## Plugin Minecraft

```bash
cd plugin
gradle test build         # JDK 21 + Gradle 8.10
cp build/libs/cipismp-store-companion-1.0.0.jar <server>/plugins/
# isi plugins/CipiStoreCompanion/config.yml: website-url, shared-secret, polling.*
```

Plugin memulai polling keluar ke toko melalui HTTPS setiap 10 detik (default), memverifikasi
setiap request dengan HMAC + timestamp + nonce, dan menjalankan perintah melalui LuckPerms
(bila ada) atau konsol. Hosting Minecraft hanya memerlukan akses keluar HTTPS; jangan membuka
port HTTP inbound untuk plugin. Perintah untuk pemain offline disimpan ke disk dan baru
mendapat ACK setelah antrean lokal berhasil disimpan. `/admin/server` menampilkan check-in
terakhir plugin; pastikan website dapat diakses melalui DNS/TLS dari hosting Minecraft.
Pemain menghubungkan akun dengan `/verify KODE` dari dashboard.

## Dokumentasi

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — komponen, ERD, alur order, keamanan
- [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) — semua keputusan yang diambil
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — status per langkah
- [`docs/GO_LIVE.md`](docs/GO_LIVE.md) — checklist rilis
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — prosedur operasi & insiden
- [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md) — panduan non-teknis untuk staf
- [`ASSETS.md`](ASSETS.md) — lisensi aset visual & font

## Status verifikasi & pekerjaan yang belum — 11 November 2026

### Sudah diverifikasi di sandbox

- `npm run typecheck`, `npx drizzle-kit check`, `git diff --check`, dan `npm run build` lulus.
  Build menandai `/cara-kerja` sebagai route dinamis karena status server memakai `fetch` no-store; build tetap sukses.
- Rantai migrasi `0000`–`0011` lulus pada PostgreSQL disposable yang baru. Katalog hasil migrasi sesuai: Cute Rp10.000, Pop Rp30.000, Milk Rp60.000, Star Rp100.000; kolom polling plugin juga tersedia. Database disposable dihapus setelah tes.
- Tes terbaru pada working tree sesi ini: **130 unit + 60 integrasi lulus** (integrasi menggunakan database disposable termigrasi).
- Database lokal preview sudah menerapkan `0008`–`0009`. Uji smoke `npm start` menghasilkan HTTP 200 untuk `/api/health`, `/`, dan `/rank`; urutan dan harga rank tampil benar.

Catatan: angka dan smoke test sebelumnya adalah bukti historis; jalankan ulang untuk commit rilis. `plan.md` memuat temuan dan batasan audit terkini.

### Belum selesai / membutuhkan runner atau lingkungan staging-produksi

- **Playwright E2E:** konfigurasi server standalone sudah diperbaiki, tetapi 10 tes belum menjalankan assertion karena Chromium tidak tersedia di sandbox. Pasang Chromium pada runner, lalu jalankan `npm run test:e2e`.
- **Plugin Paper:** JDK 21 dan Gradle tidak tersedia di sandbox, serta repo tidak memiliki Gradle Wrapper; kompilasi dan JUnit Java belum terverifikasi. Jalankan `cd plugin && gradle test build` di runner ber-toolchain. Tambahkan tes untuk pemulihan antrean offline ketika penulisan marker selesai gagal.
- **Beban dan container:** uji k6 serta validasi/build Docker Compose belum dijalankan lokal karena k6 dan Docker tidak tersedia.
- **Integrasi nyata di staging:** uji webhook Tripay/Midtrans, email, Discord OAuth, Turnstile, serta Paper/LuckPerms—polling HTTPS, HMAC, ACK/retry, pemain offline, revoke rank melalui plugin, RCON untuk kit yang diizinkan, dan permission PlayerKits. Tes lokal memakai database disposable dan tidak menggantikan tes layanan live.
- **Rilis production:** database production belum diubah. Verifikasi backup/restore dan drift schema/data terlebih dahulu, lalu rencanakan migrasi yang belum diterapkan hingga `0011`, seed, rahasia environment, TLS/domain, worker, dan cron di lingkungan production.
- **Go-live non-fungsional:** Lighthouse, ukuran layar/reduced-motion, monitoring/backup/alert, lisensi aset Minecraft, dan tinjauan hukum syarat/privasi/penjualan masih perlu dituntaskan. Detail checklist ada di [`docs/GO_LIVE.md`](docs/GO_LIVE.md) dan [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Kebijakan

Semua penjualan final; tidak ada refund, pembatalan setelah bayar, atau pengembalian dana
lewat sistem. Sengketa ditandai `DISPUTED` dan ditangani manual tanpa mengembalikan dana.
Syarat lengkap ada di halaman `/legal/syarat-penjualan`, `/legal/syarat-layanan`, dan
`/legal/kebijakan-privasi`.

CipiSMP Store bukan produk resmi Mojang Studios atau Microsoft. Minecraft adalah merek
dagang Mojang Studios. Kami tidak berafiliasi dengan Mojang maupun Microsoft.
