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

## 1. Order dibayar tetapi akses atau reward belum masuk

1. Buka `/admin/pesanan/<id>`. Status order dan daftar pembayaran terlihat di sana.
2. Lihat bagian **Pengiriman**:
   - `QUEUED` lama pada mode plugin → cek check-in plugin; plugin mengambil baris langsung dari database poll.
     Pada mode RCON, cek `docker compose logs worker`.
   - `SENT` lebih dari 3 menit → lease kedaluwarsa dan dipulihkan pada poll berikutnya.
     Jika plugin benar-benar offline, setelah mengaktifkan RCON klik **Kirim ulang** untuk baris itu.
   - `FAILED` → lihat kolom error. Perbaiki penyebab (plugin/RCON), lalu **Kirim ulang** bila perlu.
   - `DEAD` → percobaan habis. Kirim ulang setelah sistem sehat; ini memulai siklus baru.
3. Bila order masih `PENDING` padahal gateway menandai lunas:
   - Pastikan webhook terdaftar di dashboard gateway dan signature valid.
   - Owner cek `/admin/pembayaran` → ringkasan webhook terakhir. `invalid-signature` berarti
     secret gateway berbeda dengan yang tersimpan; staf lain eskalasi ke Owner.
   - Bila dana benar-benar masuk, verifikasi di dashboard gateway lalu staf dengan izin
     `orders.write` dapat **Tandai lunas manual** dengan alasan yang jelas. Aksi ini diaudit.
4. Bila order `EXPIRED` lalu pembayaran datang terlambat: webhook tetap memprosesnya
   (`EXPIRED → PAID` diizinkan). Jangan membuat order baru untuk pembayaran yang sama.

## 2. Plugin tidak polling / delivery tertunda

Gejala: `/admin/server` menunjukkan check-in plugin lebih lama dari 60 detik, atau delivery
`QUEUED` menunggu poll / `FAILED` setelah plugin tidak mengirim ACK.

1. Gunakan **Cek status plugin** di `/admin/server`. Endpoint plugin tidak lagi dibuka ke
   internet; jangan mencoba `curl` ke host/port Minecraft.
2. Periksa log server Minecraft untuk `Delivery polling HTTPS aktif` dan peringatan request.
   Pastikan `website-url` memakai URL publik HTTPS yang benar, DNS/TLS dapat dijangkau dari
   hosting Minecraft, dan jam host tersinkron NTP.
3. Pastikan `shared-secret` pada config plugin sama persis dengan `PLUGIN_SHARED_SECRET`
   pada environment website, lalu restart plugin dan periksa check-in terakhir.
4. Jika plugin tidak dapat dipulihkan, ubah metode sementara ke **RCON** di `/admin/server`
   hanya bila RCON sudah diamankan/dapat dijangkau dari web; setelah plugin sehat, pilih
   kembali **Plugin companion (polling HTTPS)**. Delivery lama akan tetap ada di database.
5. Delivery pemain offline di-ACK setelah antrean lokal berhasil disimpan ke disk; perintah
   dijalankan saat pemain login. Jika antrean penuh atau disk gagal ditulis, plugin mengirim
   kegagalan agar website mencoba ulang; perbaiki ruang antrean/disk lalu pantau `/admin/pengiriman`.

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
2. Simpan bukti melalui Owner/ops teknis yang berwenang: `payment_events.raw_payload` bersifat
   sensitif dan tidak ditampilkan di panel. Jangan menyalin payload, header, atau IP ke chat.
   Kumpulkan juga log pengiriman dan waktu join pemain.
3. Tanggapi gateway sesuai prosedur mereka. Panel saat ini tidak menyediakan aksi untuk
   memulihkan status sengketa; eskalasi ke Owner dan jangan mengubah database langsung.
4. Catat keputusan dan tindak lanjut di catatan internal order (`/admin/pesanan/<id>`).

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
| Kredensial gateway | Owner menyimpan ulang lewat `/admin/pembayaran` (otomatis terenkripsi), lalu menguji kesiapan gateway. |
| Password owner | Login → `/dashboard/keamanan` → ganti password (semua sesi lain keluar). |

## 9. Daftar periksa harian (5 menit)

- `/admin` → "Perlu perhatian" harus 0.
- `/admin/pengiriman` → tidak ada `DEAD`.
- Owner: `/admin/pembayaran` → tidak ada `UNDERPAID` menggantung.
- `/admin/pesanan?status=FAILED` → kosong.
- Backup terakhir berhasil.
