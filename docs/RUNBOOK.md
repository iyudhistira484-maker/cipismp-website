# Runbook operasional

Prosedur untuk kejadian nyata. Perintah diasumsikan dijalankan di server produksi, di
direktori proyek, dengan `.env` terisi dan Docker aktif.

## 0. Cek cepat kesehatan sistem

```bash
docker compose ps                      # semua service "Up", migrate "Exited (0)"
curl -s https://<domain>/api/health    # {"status":"ok","db":"up",...}
docker compose logs --tail=50 web
docker compose logs --tail=50 worker
```

`/api/health` mengembalikan 503 bila database tidak bisa diakses. Endpoint ini hanya
memeriksa database dan ringkasan pembayaran, bukan bukti worker, email, plugin, backup,
atau provider sehat. Pasang monitor eksternal pada `/api/health` dan halaman utama,
serta alert terpisah untuk worker berhenti, job `DEAD`/menumpuk, delivery `DEAD`,
RCON `SENT` yang tertahan, heartbeat plugin, disk dan kegagalan backup. Tentukan ambang,
kanal dan penanggung jawab di staging; aplikasi tidak otomatis memasang monitor tersebut.

## 1. Order dibayar tetapi akses atau reward belum masuk

1. Buka `/admin/pesanan/<id>`. Status order dan daftar pembayaran terlihat di sana.
2. Lihat bagian **Pengiriman**:
   - `QUEUED` lama pada mode plugin → cek check-in plugin; plugin mengambil baris langsung dari database poll.
     Pada mode RCON, cek `docker compose logs worker`.
   - `SENT` plugin: lease kedaluwarsa setelah 3 menit dan diproses pada poll berikutnya.
     `SENT` RCON berarti hasil mungkin sudah diterapkan; **tidak dipulihkan otomatis** dan
     tidak boleh diulang sebelum rekonsiliasi. Jangan ganti ke RCON untuk mem-bypass lease.
   - `FAILED`/`DEAD` → periksa log, antrean plugin, marker dan hasil pemain di Minecraft.
     Perintah bisa saja sudah sebagian atau seluruhnya berjalan. Setelah pemeriksaan oleh staf
     yang berwenang, klik **Kirim ulang** hanya jika aman dan centang konfirmasi; status
     sengketa, selesai, antre dan sedang dikirim tidak dapat di-reset dari panel.
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
4. Jangan berpindah ke RCON untuk mengulang delivery yang sudah pernah dikirim atau
   diantrekan plugin: perintah masih dapat dieksekusi setelah pemain login. Hentikan proses
   yang relevan dan rekonsiliasi antrean, marker dan hasil in-game sebelum perubahan metode;
   pastikan RCON aman dan proses transisi disetujui operator.
5. Delivery pemain offline di-ACK sebagai **belum selesai** setelah antrean lokal tersimpan.
   Rank maupun kit tidak dijalankan langsung dari antrean lokal, termasuk melalui
   `/cipistore flush`: pemain harus menyelesaikan LoginSecurity dan tetap online sampai
   website memberikan lease baru setelah pemeriksaan ulang (biasanya sekitar satu menit
   atau lebih). Jika website menahan delivery, salinan lokal tetap ada dan perlu rekonsiliasi;
   jangan hapus atau kirim ulang tanpa memeriksa status dan bukti eksekusi. Plugin lama tidak
   mempunyai pengaman ini. Jika antrean penuh atau disk gagal ditulis, perbaiki dan pantau
   `/admin/pengiriman`.
6. Plugin baru menyimpan intent sebelum perintah dan menolak replay jika hasilnya belum
   pasti; marker selesai memungkinkan ACK dikirim ulang. Timeout/partial/crash atau gagal
   simpan marker bisa memerlukan rekonsiliasi manual meskipun tidak ada perintah yang berjalan.
   Catat ID delivery, log, urutan perintah dan kondisi aktual pemain. Jangan menghapus marker,
   mereset status `SENT`, mengulang seluruh paket atau mengubah database hanya berdasarkan
   dugaan; eskalasi ke owner/ops untuk rencana koreksi terarah setelah bukti terkumpul.
   Belum ada UI pemulihan otomatis untuk intent yang tidak pasti.
7. Marker disimpan per instalasi plugin (`delivery-intents/`) dan tidak dipangkas otomatis;
   pantau kapasitas disk. Gunakan satu instalasi aktif dan storage yang persisten. Server
   ganda/storage terpisah, restore lama, versi plugin lama, kehilangan disk atau kondisi
   filesystem belum menjamin deduplikasi. Uji semua skenario pada staging terlebih dahulu.

## 3. Worker mati / antrean menumpuk

```bash
docker compose restart worker
docker compose logs --tail=100 worker
```

Cek jumlah job tertunda:

```sql
SELECT status, count(*) FROM jobs GROUP BY status;
SELECT id, type, status, attempts, last_error FROM jobs
WHERE status IN ('PENDING','RUNNING','DEAD') ORDER BY created_at LIMIT 20;
-- Perlu investigasi manual; jangan reset atau kirim ulang hanya dari query ini.
SELECT id, method, status, attempts, updated_at FROM deliveries
WHERE status = 'SENT' AND method = 'RCON' AND updated_at < now() - interval '10 minutes';
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

Backup database dan folder data plugin (termasuk `pending-deliveries.yml` dan
`delivery-intents/`) sesuai kebijakan penyimpanan terenkripsi. Lakukan koordinasi agar
snapshot database dan plugin konsisten; jangan hapus marker saat membersihkan backup.
Perintah berikut hanya contoh untuk **instance yang telah diverifikasi**, menggunakan
user/database yang benar dari environment container:

```bash
set -o pipefail
umask 077
docker compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "backup-$(date +%F-%H%M).sql.gz"
```

Uji `gzip -t` dan restore ke database **staging kosong dan terisolasi**, bukan ke produksi;
gunakan perintah `psql -v ON_ERROR_STOP=1` dengan target staging yang diverifikasi.
Dokumentasikan commit/migrasi dan pemeriksaan data setelah restore. Jangan menimpa
folder marker plugin dengan backup lama tanpa rekonsiliasi: pengiriman setelah waktu
backup dapat terulang. Uji pemulihan secara berkala dan simpan kunci enkripsi secara aman.

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
| Password owner | Login → `/admin/keamanan` → ganti password (semua sesi lain keluar). |

## 9. Daftar periksa harian (5 menit)

- `/admin` → "Perlu perhatian" harus 0.
- `/admin/pengiriman` → tidak ada `DEAD`.
- Owner: `/admin/pembayaran` → tidak ada `UNDERPAID` menggantung.
- `/admin/pesanan?status=FAILED` → kosong.
- Backup terakhir berhasil.
