# Asumsi & Keputusan

Setiap hal yang tidak ditentukan brief diputuskan di sini. Semua keputusan dibuat agar
sistem **benar dan dapat dioperasikan**, bukan sekadar tampak lengkap.

## 1. ORM: Drizzle, bukan Prisma

**Keputusan:** PostgreSQL dengan Drizzle ORM dan driver `pg`.

**Alasan:** Prisma membutuhkan binary engine yang diunduh saat `prisma generate`. Lingkungan
build/deploy kami dibatasi ke npm/PyPI/GitHub saja, sehingga unduhan `binaries.prisma.sh`
gagal dan aplikasi tidak bisa di-build — risiko yang tidak dapat diterima untuk produk
komersial. Drizzle menghasilkan SQL eksplisit, migrasi versioned yang bisa direview, dan
tidak membutuhkan binary tambahan.

**Dampak:** Semua persyaratan data dari brief tetap terpenuhi (PostgreSQL, migrasi,
seed, enum, constraint, index, integer uang, timestamptz). Perintah: `npm run db:migrate`
dan `npm run db:seed`.

## 2. Auth: implementasi langsung, bukan Auth.js/Lucia

**Keputusan:** Session cookie sendiri + argon2id (`@noble/hashes`) + TOTP RFC 6238 yang
ditulis sendiri.

**Alasan:** Brief meminta kontrol detail yang sulit dipetakan ke library tanpa fork:
rotasi session, daftar sesi aktif dengan revoke, idle + absolute timeout, 2FA wajib staf,
anti-replay kode TOTP, dan alert login perangkat baru. Implementasi ini ±250 baris,
seluruhnya teruji, tanpa dependensi auth pihak ketiga.

## 3. Antrean job: PostgreSQL, bukan BullMQ

**Keputusan:** Tabel `jobs` dengan `SELECT ... FOR UPDATE SKIP LOCKED`, plus proses worker
terpisah (`npm run worker`).

**Alasan:** BullMQ membutuhkan Redis; Redis opsional di repo ini (dipakai untuk rate limit
bila tersedia). Antrean berbasis Postgres memberi jaminan yang sama untuk beban toko ini:
atomik, retry + backoff, dead-letter, aman multi-instance, dan transaksional dengan data
order. Tidak ada job yang hilang ketika Redis mati.

## 4. Redis opsional

Rate limiting memakai Redis bila `REDIS_URL` diisi; jika kosong, dipakai sliding window
in-memory (cukup untuk satu instance / dev / test). Cache katalog dan status server juga
in-memory dengan TTL. Docker Compose tetap menyertakan Redis agar produksi multi-instance
memakai limiter bersama.

## 5. Provider email

`EMAIL_PROVIDER` = `resend` | `smtp` | `outbox`. Default development `outbox`: email
tetap disimpan di tabel `email_outbox` dan bisa dibaca di `/admin/email` (kotak surat
pengembangan). Di produksi isi `RESEND_API_KEY` atau kredensial SMTP.

## 6. Verifikasi Minecraft

- Mode `mojang` (produksi): nama Java divalidasi ke `api.mojang.com`, UUID diambil dari
  sana. Nama yang tidak ada ditolak sebelum checkout.
- Mode `mock` (dev/test): UUID deterministik ala offline-mode (`OfflinePlayer:<nama>`),
  sehingga tidak butuh jaringan dan tetap stabil antar-restart.
- Bedrock: nama Floodgate berawalan titik. Karena XUID tidak tersedia lewat API publik,
  UUID Bedrock deterministik (`FloodgatePlayer:<nama>`) sampai plugin melaporkan UUID
  asli saat verifikasi in-game; setelah itu UUID asli yang dipakai.
- Avatar kepala memakai `mc-heads.net` (layanan publik, hanya URL, bukan aset yang
  disalin). Bila layanan gagal, inisial nama ditampilkan.

## 7. Enkripsi secret

`ENCRYPTION_KEY` (base64 32 byte) dipakai untuk AES-256-GCM. Kredensial gateway, password
RCON, dan secret TOTP disimpan terenkripsi. Rotasi key: dekripsi dengan key lama lalu
enkripsi ulang (prosedur ada di `RUNBOOK.md`).

## 8. Kebijakan pembatalan & comp

- Pembeli dapat membatalkan order `PENDING` sendiri; `PAID` dan seterusnya tidak bisa.
- Tidak ada refund. Bila item gagal dikirim, solusinya pengiriman ulang.
- Comp grant (pemberian gratis oleh staf) wajib alasan, tercatat di audit log, dan
  dibatasi role `OWNER`/`ADMIN`.
- Chargeback: order menjadi `DISPUTED`; staf memutuskan mencabut entitlement. Ban akun
  dilakukan manual di server (di luar scope teknis toko) — toko menandai catatan pelanggan.

## 9. Pajak & biaya gateway

- `taxPercent` default 0% (dapat diubah admin). Pajak dihitung dari `subtotal - diskon`,
  ditampilkan terpisah di ringkasan dan invoice.
- `feeMode = absorb` (default): biaya gateway ditanggung toko, tidak muncul di total
  pembeli. `pass`: biaya flat + persen ditambahkan ke total dan diberi label "Biaya
  layanan" agar transparan.

## 10. Kupon

- Satu kupon per order, tidak dapat digabung.
- Kupon divalidasi ulang saat checkout (bukan hanya saat dimasukkan ke keranjang).
- `maxPerUser` dihitung dari email pembeli, karena tamu tidak punya akun.
- Batas pemakaian tidak "dikunci" saat keranjang dibuat; baru dicatat saat order dibuat.

## 11. Batas MVP yang disengaja

- Fitur gifting belum tampil di UI (flag `features.gifting = false`), tetapi mesin harga
  sudah mendukung `targetUuid` berbeda dan diuji — sesuai brief §3.4.
- Tidak ada season pass, langganan, gacha, multi-currency, atau refund.
- Wave 2/3 (Discord, tiket, bot, dsb.) tidak dibangun.

## 12. Asumsi produk & operasional

| Hal | Asumsi |
| --- | --- |
| Order number | `CIPS-XXXXXXXX` (8 karakter, tanpa huruf ambigu) |
| Kedaluwarsa order | 30 menit (bisa diubah di admin) |
| Freeze window | 3 hari terakhir season (per season, bisa diubah) |
| Zona waktu | Semua jadwal & email memakai Asia/Jakarta (WIB) |
| Usia minimum | 13 tahun + persetujuan wali untuk di bawah umur |
| Bahasa | Indonesia; semua string UI ada di `src/lib/i18n.ts` |
| Server & plugin | Satu server default; skema mendukung lebih banyak server untuk Wave 2 |
| User-agent | Daftar sesi menampilkan label sederhana (Chrome · Windows) tanpa library parsing |
| Legal | Teks syarat/privasi/penjualan adalah **draf teknis** dan wajib direview penasihat hukum sebelum go-live |

## 13. Penyimpangan kecil lain

- "Cart drawer" diimplementasikan sebagai halaman keranjang dengan transisi halus dan
  tombol tambah yang optimistis; tidak ada drawer overlay agar navigasi tetap sederhana
  dan dapat diakses keyboard di semua ukuran layar.
- PDF invoice dibuat tanpa dependensi eksternal (generator PDF minimal di
  `src/server/receipts/pdf.ts`) sehingga tidak ada layanan rendering pihak ketiga.
- Playwright disiapkan untuk CI; sandbox pengembangan ini tidak mengunduh browser.
  Seluruh logika bisnis diuji dengan Vitest terhadap Postgres sungguhan.

## 11. Linting: `tsc --noEmit` sebagai gerbang, tanpa ESLint

**Keputusan:** kualitas kode dijaga oleh TypeScript strict (`npm run typecheck`), review,
dan test; tidak ada konfigurasi ESLint di repo.

**Alasan:** paket dan plugin ESLint tidak tersedia di lingkungan build saat proyek ini
disusun, sehingga menambahkan konfigurasi tanpa bisa menjalankannya akan menjadi klaim
palsu. Semua kode tetap lolos `tsc --noEmit` dengan `strict: true` sebelum di-commit.

**Dampak:** CI menjalankan typecheck, test, build, dan Playwright. Bila nanti ESLint
ditambahkan, pasang `eslint` + `eslint-config-next` dan tambahkan job terpisah di
`.github/workflows/ci.yml`.

## 12. Notifikasi staf: email + log, tanpa integrasi Discord wajib

**Keputusan:** `alertStaff()` mengirim email ke `site.supportEmail` dan menulis notifikasi
di database; Discord hanya tautan di footer.

**Alasan:** brief menyebut Discord sebagai kanal opsional. Integrasi webhook Discord bisa
ditambahkan di satu tempat (`src/server/notifications.ts`) tanpa mengubah domain lain.

## 13. Batas uji yang bisa dijalankan di lingkungan ini

Lingkungan penyusunan tidak memiliki Docker, Java, maupun Redis, sehingga:

- `docker compose up` dan `./gradlew build` tidak dieksekusi di sini; keduanya ditulis
  mengikuti dokumentasi resmi dan diverifikasi dengan pembacaan kode + parse YAML.
- Plugin Java tidak dikompilasi; API yang dipakai (Paper 1.21, LuckPerms 5.4) adalah API
  stabil dan setiap pemanggilan diperiksa manual.
- Uji e2e Playwright ditulis dan dikonfigurasi, tetapi browser tidak bisa diunduh di
  lingkungan ini; jalankan `npx playwright install chromium` lalu `npm run test:e2e`.

## 14. Wave 2: ulasan, gifting, dan login Discord

**Keputusan:**

- **Ulasan hanya untuk pembeli.** Syaratnya ada baris `order_items` pada order milik akun
  tersebut dengan status PAID/DELIVERING/DELIVERED/DISPUTED. Pesanan yang dihadiahkan tidak
  memberi hak mengulas bagi penerima (penerima tidak punya order), sedangkan pembeli yang
  membeli untuk diri sendiri bisa mengulas. Tidak ada ulasan anonim: setiap ulasan terikat
  akun, meski namanya disamarkan di halaman publik.
- **Semua ulasan dimoderasi lebih dulu** (`PENDING` → `APPROVED`/`HIDDEN`) karena toko
  Minecraft kerap jadi sasaran spam dan ujaran kebencian. Satu ulasan per akun per produk
  dijaga oleh indeks unik database, bukan hanya validasi UI.
- **Hadiah tidak mengubah kepemilikan:** entitlement dikirim ke UUID penerima, sedangkan
  pembeli hanya tercatat di `order_items.meta` untuk keperluan dukungan pelanggan. Hadiah ke
  UUID sendiri ditolak agar tidak menjadi celah melewati aturan "satu rank per pemain".
- **Login Discord tidak pernah menggabungkan akun lewat email.** Discord hanya bisa dipakai
  bila `users.discord_id` sudah tertaut dari akun yang sedang login. Staf wajib 2FA sebelum
  menautkan, sehingga tautan Discord tidak bisa dipakai untuk melewati langkah kedua.
- **Fitur bisa dimatikan tanpa migrasi:** kupon, hadiah, ulasan, dan login Discord punya
  toggle di `/admin/pengaturan`. Mematikan fitur hanya menyembunyikan UI; data tetap utuh.

**Dampak:** kolom `users.discord_id/discord_username` dan tabel `reviews` datang dari migrasi
`0004_reviews_discord`; dua variabel `.env` baru (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`)
bersifat opsional dan tidak memblokir start aplikasi.
