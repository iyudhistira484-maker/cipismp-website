# Progres pembangunan

Diperbarui setiap akhir langkah. Status: ✅ selesai · 🚧 sedang dikerjakan · ⏭ berikutnya

## Ringkasan

| Langkah | Status | Catatan |
| --- | --- | --- |
| 0. Arsitektur & asumsi | ✅ | `ARCHITECTURE.md`, `ASSUMPTIONS.md` |
| 1. Setup, DB, seed, design system | 🚧 | DB + seed + token + komponen dasar selesai; halaman produk berjalan |
| 2. Auth & email | ⏭ | |
| 3. Storefront, keranjang, checkout | ⏭ | Beranda, kartu rank/kit selesai |
| 4. Pembayaran | ⏭ | |
| 5. Season, pengiriman, plugin | ⏭ | |
| 6. Dashboard pemain | ⏭ | |
| 7. Dashboard admin | ⏭ | |
| 8. Hardening, CI, go-live | ⏭ | |

## Log

### Langkah 0 — Arsitektur
- Menetapkan stack final dan mencatat 3 penyimpangan utama (Drizzle, auth mandiri,
  antrean Postgres) beserta alasannya.
- ERD, peta job, matriks keamanan, dan token desain didokumentasikan.

### Langkah 1 — Fondasi
- Skema database lengkap (23 tabel, enum native, unique parsial untuk satu season aktif,
  dedupe webhook, index hot path).
- Migrasi SQL versioned + seed idempoten: Season 1 (90 hari), 3 rank, 3 kit beserta item,
  template perintah LuckPerms/EssentialsX, kupon contoh, akun owner dari env.
- Design token (warna, radius, shadow, tipografi self-host) + komponen dasar (button,
  field, dialog, tabs, accordion, tooltip, badge, alert, empty state, skeleton).
- Art original: 22 sprite item 12×12, kubus isometrik untuk blok, badge rank, logo.
- Beranda: hero asimetris, panel status server (Java/Bedrock + salin IP), kartu rank & kit,
  cara kerja, FAQ.

## Berikutnya
- Halaman /rank, /kit, detail produk, keranjang, checkout.
- Registrasi/login/verifikasi/reset, dashboard, panel admin.
