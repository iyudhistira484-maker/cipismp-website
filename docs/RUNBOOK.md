# Runbook operasional

Prosedur untuk kejadian nyata. Perintah diasumsikan dijalankan di server produksi, di
direktori proyek, dengan `.env` terisi dan Docker aktif.

## 0. Cek cepat kesehatan sistem

```bash
docker compose ps                      # semua service "Up", migrate "Exited (0)"
curl -s https://<domain>/api/health    # {"ok":true,...}
docker compose logs --tail=50 web
docker compose logs --tail=50 worker
```

`/api/health` mengembalikan 503 bila database tidak bisa diakses.

## 1. Order dibayar tetapi item tidak masuk

1. Buka `/admin/pesanan/<id>`. Status order dan daftar pembayaran terlihat di sana.
2. Lihat bagian **Pengiriman**:
   - `QUEUED` lama → worker mati atau plugin tidak merespons. Cek `docker compose logs worker`.
   - `FAILED` → lihat kolom error. Perbaiki penyebab (plugin/RCON), lalu **Kirim ulang**.
   - `DEAD` → percobaan habis. Kirim ulang setelah sistem sehat; ini menambah percobaan baru.
3. Bila order masih `PENDING` padahal gateway menandai lunas:
   - Pastikan webhook terdaftar di dashboard gateway dan signature valid.
   - Cek `/admin/pembayaran` → daftar webhook terakhir. `invalid-signature` berarti secret
     gateway berbeda dengan yang tersimpan.
   - Bila dana benar-benar masuk, verifikasi di dashboard gateway lalu **Tandai lunas manual**
     dengan alasan yang jelas. Aksi ini tercatat di audit log.
4. Bila order `EXPIRED` lalu pembayaran datang terlambat: webhook tetap memprosesnya
   (`EXPIRED → PAID` diizinkan). Jangan membuat order baru untuk pembayaran yang sama.

## 2. Plugin offline

Gejala: pengiriman `FAILED` dengan pesan "Plugin menolak request" atau timeout.

1. `curl -s http://<plugin-host>:8081/cipismp/health` (dengan signature) atau pakai tombol
   **Uji plugin** di `/admin/server`.
2. Periksa log server Minecraft: plugin gagal start, port dipakai, atau secret salah.
3. Jika plugin tidak bisa dipulihkan cepat, sementara ubah metode pengiriman ke **RCON** di
   `/admin/server`, lalu kirim ulang pengiriman yang tertunda.
4. Setelah plugin hidup lagi, kembalikan metode ke **PLUGIN**.
5. Perintah yang sudah masuk antrean plugin (pemain offline) akan terkirim saat pemain login.

## 3. Worker mati / antrean menumpuk

```bash
docker compose restart worker
docker compose logs --tail=100 worker
```

Cek jumlah job tertunda:

```sql
SELECT status, count(*) FROM jobs GROUP BY status;
SELECT id, type, status, attempts, last_error FROM jobs
WHERE status IN ('PENDING','FAILED') ORDER BY created_at LIMIT 20;
```

Job yang terus gagal karena data buruk boleh ditandai `DEAD` manual setelah investigasi;
jangan menghapus baris (audit butuh jejaknya).

## 4. Pengiriman tertahan karena entitlement/season salah

- Periksa season aktif: `/admin/season`. Hanya satu season boleh ACTIVE.
- Entitlement aktif per pemain terlihat di halaman pelanggan; pencabutan manual hanya
  untuk kasus salah beri (comp), bukan karena permintaan refund.
- Untuk salah beri rank (mis. comp ganda), gunakan **Cabut** pada entitlement lalu kirim
  perintah REVOKE yang sesuai lewat konsol server.

## 5. Sengketa / chargeback

Webhook gateway akan menandai order `DISPUTED` dan mengirim alert ke staf.

1. Jangan mengirim ulang item. Jangan mengembalikan dana lewat sistem — tidak ada fitur refund.
2. Simpan bukti: `payment_events.raw_payload` (payload mentah), log pengiriman, waktu join pemain.
3. Tanggapi gateway sesuai prosedur mereka. Bila sengketa dimenangkan, tandai order
   `DISPUTED → DELIVERED` lewat mekanisme order yang ada dan catat alasannya.
4. Catat keputusan di catatan internal order (`/admin/pesanan/<id>`).

## 6. Database

Backup:

```bash
docker compose exec -T db pg_dump -U cipi cipismp | gzip > backup-$(date +%F-%H%M).sql.gz
```

Restore (lingkungan terpisah dulu, jangan ke produksi langsung):

```bash
gunzip -c backup-2026-01-01-0300.sql.gz | docker compose exec -T db psql -U cipi -d cipismp
```

Db tidak bisa diakses: `docker compose ps db`, `docker compose logs db`, cek disk penuh.
Aplikasi akan mengembalikan 503 dari `/api/health` dan mencatat error — jangan panik-edit
data langsung di tabel.

## 7. Akhir season

1. Buka `/admin/season`.
2. Pilih season aktif, klik **Pratinjau dampak** — pastikan jumlah entitlement dan pemain
   sesuai harapan.
3. Simulasi (`Simulasi`) sekali lagi bila perlu.
4. Pilih **Eksekusi sungguhan**, ketik `AKHIRI SEASON`, isi alasan, kirim.
5. Verifikasi: season baru ACTIVE, entitlement season lama nonaktif, pengiriman REVOKE
   diantrekan, audit log berisi `season.transition`.
6. Umumkan di Discord: rank lama tidak terbawa, tidak ada refund.

Transisi aman dijalankan ulang (idempoten): season yang sudah ENDED mengembalikan
`alreadyEnded` tanpa mengubah data.

## 8. Rotasi rahasia

| Rahasia | Langkah |
| --- | --- |
| `PLUGIN_SHARED_SECRET` | Perbarui `.env` + `config.yml` plugin → restart web, worker, dan server MC. Pengiriman yang gagal saat transisi perlu dikirim ulang. |
| `SESSION_SECRET` | Perbarui `.env` → restart web. Semua sesi login menjadi tidak valid; staf perlu login + 2FA lagi. |
| `ENCRYPTION_KEY` | **Jangan** diganti tanpa mengenkripsi ulang `payment_credentials`; kredensial lama tidak akan terbaca. |
| Kredensial gateway | Simpan ulang lewat `/admin/pembayaran` (otomatis terenkripsi). |
| Password owner | Login → `/dashboard/keamanan` → ganti password (semua sesi lain keluar). |

## 9. Daftar periksa harian (5 menit)

- `/admin` → "Perlu perhatian" harus 0.
- `/admin/pengiriman` → tidak ada `DEAD`.
- `/admin/pembayaran` → tidak ada `UNDERPAID` menggantung.
- `/admin/pesanan?status=FAILED` → kosong.
- Backup terakhir berhasil.
