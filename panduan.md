# Panduan staging dan persiapan rilis CipiSMP Store

Panduan ini untuk Owner dan operator server. Tujuannya membuktikan bahwa website, pembayaran, dan server Minecraft bekerja bersama **sebelum** checkout produksi dibuka. Daftar ringkas tugas juga ada di [plan.md](plan.md#32-langkah-berikutnya-staging-dan-keputusan-checkout-produksi).

**Status saat ini:** kode sudah dibuat dan tes otomatis/build lulus, tetapi belum diuji pada server Minecraft dengan plugin dan konfigurasi yang benar-benar terpasang. Belum ada deployment atau perubahan data produksi. Server offline-mode tidak dilarang memakai checkout; kita menundanya sampai pengujian dan rekonsiliasi cukup untuk menerima pembayaran dengan aman.

## 1. Aturan sebelum mulai

- Gunakan **website, database, worker, server Minecraft, antrean dan akun gateway yang terpisah dari produksi**. Gunakan akun pemain dan data uji, bukan akun/dana pelanggan.
- Batasi akses staging untuk penguji. Namun endpoint plugin dan, jika diperlukan, webhook gateway sandbox harus tetap bisa diakses oleh pihak yang berwenang. Companion perlu akses HTTPS keluar ke website staging; **tidak perlu membuka port HTTP masuk pada server Minecraft**.
- Gunakan rahasia staging yang berbeda dari produksi. Jangan mengirim password, token, secret, kode 2FA, kode `/verify`, URL pesanan privat, atau payload webhook ke chat, screenshot publik, maupun Git.
- Jangan menjalankan migrasi, seed, restart, penghapusan file, pengiriman ulang, atau perubahan grup pada produksi selama pengujian ini. Jika ada hasil yang meragukan, berhenti dan catat, jangan menebak.
- Jangan membuat atau mengaktifkan promosi otomatis. `freerank` khusus event dan tidak boleh ditambah, dicabut, atau diubah oleh otomatisasi toko.

## 2. Yang perlu disiapkan

| Kebutuhan | Yang perlu dilakukan |
| --- | --- |
| Operator | Orang yang dapat mengelola website staging, server Minecraft staging, dan gateway sandbox. |
| Website dan database | Domain HTTPS staging, database PostgreSQL dan worker terpisah. Domain harus dapat dijangkau server Minecraft. |
| Minecraft staging | Salinan konfigurasi yang relevan, bukan data pelanggan: Paper **26.1.2 build 74** dan Java **25** yang dilaporkan Owner, serta LoginSecurity **3.3.1**, Floodgate **2.2.5-SNAPSHOT b138-fc99cfc**, Geyser-Spigot **2.11.0-SNAPSHOT**, LuckPerms dan PlayerKits2 **1.23.1**. Pastikan versi dan pengaturan benar-benar cocok dengan instalasi yang akan dipakai. |
| Akun uji | Minimal satu akun Java, satu Bedrock, akun pemain lain untuk hadiah, dan akun uji staf/alternatif. Buat akun website uji sendiri; gunakan 2FA untuk akun staf uji. |
| Pembayaran | Gateway dalam mode **sandbox**, bukan live. Simulasi `FAKE` hanya tersedia bila `NODE_ENV` bukan `production`; Docker Compose bawaan menjalankan web dengan `NODE_ENV=production`, sehingga `FAKE` tidak tersedia di sana meskipun `APP_ENV=staging`. |
| Bukti | Catatan waktu, versi/commit, nama skenario, status order/delivery dan hasil in-game tanpa rahasia atau data pribadi yang tidak perlu. |

> **Keamanan jaringan:** karena server memakai offline-mode, batasi jalur koneksi agar pemain tidak dapat melewati Geyser/Floodgate atau mekanisme autentikasi yang seharusnya. Verifikasi pengaturan Floodgate, forwarding, firewall dan cara akses bersama operator; kode website saja tidak dapat menjamin jaringan tidak bisa disalahgunakan.

## 3. Siapkan website staging

1. Buat lingkungan terisolasi. Bila memakai Docker Compose, sebaiknya pakai host atau proyek Compose terpisah dan pastikan nama proyek, port, volume database, file `.env`, domain dan kredensial benar-benar berbeda dari produksi. Periksa target **sebelum** menjalankan perintah; jangan memakai ulang volume atau database produksi.
2. Buat `.env` staging dari `.env.example`, lalu isi minimal:
   - `APP_ENV=staging`, `APP_URL` dan `NEXT_PUBLIC_APP_URL` ke domain **HTTPS staging** tanpa slash terakhir.
   - `DATABASE_URL` dan variabel PostgreSQL mengarah ke database staging yang baru; samakan nama pengguna/database/password yang diperlukan Compose.
   - `SESSION_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `PLUGIN_SHARED_SECRET`, dan password Owner berupa nilai acak **khusus staging**. `ENCRYPTION_KEY` harus base64 dari 32 byte; simpan dengan aman.
   - `MINECRAFT_LOOKUP_MODE=offline`. Jangan gunakan `mojang` untuk identitas Java offline atau `mock` sebagai solusi produksi.
   - Konfigurasi email uji dan gateway **sandbox**. Jangan masukkan kredensial gateway live. Isi `SEED_OWNER_*` hanya untuk akun Owner staging.
3. Pada lingkungan staging yang telah diverifikasi, jalankan migrasi sampai **0019** dan seed awal, misalnya dengan Compose:

   ```bash
   docker compose up -d --build
   docker compose run --rm seed
   docker compose ps
   ```

   Service `migrate` harus selesai tanpa error. Perintah ini mengubah database yang dikonfigurasi: **jangan jalankan jika belum yakin targetnya staging**. Seed membuat data awal dan Owner bila diperlukan; seed tidak lagi membuat kupon contoh.
4. Masuk sebagai Owner staging, aktifkan 2FA, dan di `/admin/server` set server default ke Minecraft staging dengan metode pengiriman **PLUGIN**. Di `/admin/pembayaran`, atur gateway dan metode **sandbox** yang akan diuji. Di `/admin/pengaturan`, pastikan checkout hanya dibuka untuk penguji staging.
5. Di `/admin/season`, pastikan ada satu season aktif dengan tanggal saat ini berada dalam periode pembelian dan di luar freeze window; atur hanya data staging. Periksa rank/kit dan template di panel produk. Default yang aman menggunakan `{uuid}`, misalnya `lp user {uuid} parent add vip` dan `lp user {uuid} permission set playerkits.kits.cipiprime true`. Template kustom dan antrean lama tidak otomatis diperbaiki.

**Catatan:** pengaturan default checkout bisa terbuka setelah seed. Karena itu batasi akses staging **sebelum** menyalakannya. Website staging tidak boleh mengirim pembayaran maupun pengiriman ke sistem produksi.

## 4. Pasang companion di Minecraft staging

1. Gunakan JAR dari build CI untuk commit yang akan diuji atau bangun dari sumber dengan JDK/Gradle sesuai target. Untuk Paper **26.1.2**, perlu Java 25 dan Gradle 9.2.1:

   ```bash
   cd plugin
   gradle build -PpaperTarget=26.1.2 --no-daemon
   ```

   JAR berada di `plugin/build/libs/` relatif terhadap root proyek. Repositori ini tidak menyediakan Gradle Wrapper; jangan mengandalkan instruksi `./gradlew` di panel saat ini. Jika memakai artifact CI, cocokkan commit, target Paper dan checksum yang disertakan; artifact memiliki masa retensi terbatas.
2. Salin JAR companion baru ke folder `plugins/` **server staging**. Pastikan LoginSecurity, Floodgate, Geyser, LuckPerms dan PlayerKits juga terpasang dan aktif. Jangan menjalankan companion lama bersamaan.
3. Setelah konfigurasi awal plugin dibuat, atur `plugins/CipiStoreCompanion/config.yml`:
   - `website-url` = URL HTTPS website staging, bukan alamat `localhost` jika website dan Minecraft berbeda host.
   - `shared-secret` = nilai yang sama dengan `PLUGIN_SHARED_SECRET` **staging**.
   - `polling.enabled: true` dan `luckperms.use-api: true`.
   - Biarkan `live-status.enabled: false` kecuali fitur tambahan ini juga sedang diuji.
4. Restart **server staging**, lalu periksa log plugin dan `/admin/server`. Status check-in baru menunjukkan plugin bisa menghubungi website, **bukan** bukti LoginSecurity, Floodgate atau pengiriman sudah benar. Catat kesalahan tanpa menyalin secret.
5. Cek koneksi Java dan Bedrock ke staging, prefix Floodgate yang tampil pada nama pemain, dan bahwa keduanya memang harus mendaftar/login melalui LoginSecurity. Website mengharapkan nama Bedrock berawalan `_`; pilih edisi yang benar karena nama Java juga dapat dimulai dengan `_`. Bila konfigurasi server berbeda, hentikan dan sesuaikan/ujikan integrasi sebelum lanjut. Profil lama berawalan titik perlu diverifikasi ulang; jangan pindahkan UUID atau akses secara otomatis.

## 5. Uji verifikasi identitas

Jalankan untuk **Java dan Bedrock**, termasuk akun Bedrock tertaut bila konfigurasi server mendukungnya. Gunakan nama yang benar-benar tampil di server.

1. Daftarkan dan login ke website dengan **akun pelanggan uji**, buka `/dashboard/minecraft`, masukkan nama pemain, dan buat kode. Kode hanya berlaku 15 menit dan sekali pakai.
2. Masuk ke server staging, **sebelum** berhasil `/login`, coba `/verify KODE`. Harapan: ditolak dan akun tidak terhubung. Jika plugin LoginSecurity sendiri memblokir perintah lebih dahulu, itu juga harus menghasilkan tidak ada tautan.
3. Selesaikan `/register` jika diperlukan dan `/login` melalui LoginSecurity, lalu jalankan `/verify KODE`. Harapan: berhasil dan dashboard menunjukkan akun aktif. Periksa secara privat bahwa UUID yang tercatat sama dengan UUID pemain yang dilaporkan server; jangan percaya UUID tebakan atau versi UUID saja.
4. Coba kembali kode yang sudah dipakai, kode salah/kedaluwarsa, kode untuk nama atau akun lain, dan akun yang sudah terhubung ke pelanggan lain. Harapan: ditolak, tidak mengambil alih profil.
5. Uji logout/reconnect, password salah, sesi bypass tanpa password, serta kondisi LoginSecurity atau Floodgate tidak siap **hanya di staging**. Harapan: verifikasi/eksekusi baru tidak berjalan tanpa status autentikasi yang diperlukan. Perhatikan bahwa gangguan sesaat setelah intent tersimpan bisa memerlukan rekonsiliasi manual.
6. Uji nama dengan kapitalisasi berbeda, perubahan nama dan profil lama pada data uji. Dalam offline-mode perubahan nama dapat mengubah UUID; konflik tidak boleh ditimpa diam-diam dan akses tidak otomatis berpindah.

## 6. Uji pembelian dan pengiriman otomatis

Gunakan gateway sandbox dan akun pemain terverifikasi pada staging. Simulasi `FAKE` bukan pengganti pengujian webhook gateway sandbox yang benar.

1. Beli rank untuk akun Java uji dan selesaikan pembayaran **sandbox**. Periksa status pembayaran/pesanan dan `/admin/pengiriman`, lalu periksa grup penerima di LuckPerms. Harapan: rank yang benar diberikan kepada UUID yang benar tanpa Owner menyetujui pesanan secara individual.
2. Ulangi untuk Bedrock; uji kit CipiPrime dan Cipi++ serta klaim dan cooldown yang dikonfigurasi di PlayerKits. Pastikan permission diberikan pada UUID yang benar dan isi kit sesuai yang disepakati.
3. Uji upgrade rank, hadiah ke akun lain yang sudah terverifikasi, comp, revoke dan transisi season **pada data uji saja**. Periksa bahwa `freerank` dan grup lain tidak berubah. Penerima hadiah offline-mode juga harus sudah terverifikasi.
4. Uji penerima offline atau belum login ketika pembayaran diterima. Harapan: delivery belum dianggap selesai. Setelah pemain login dan tetap online, rank maupun kit menunggu lease/polling website berikutnya—biasanya sekitar satu menit atau lebih, bukan langsung dari salinan antrean lokal. Periksa lagi status dan hasil in-game.
5. Uji webhook duplikat, ACK hilang, restart website/plugin, storage/queue gagal, dan perintah yang sebagian gagal di staging. Bandingkan order, `/admin/pengiriman`, log, marker dan hasil in-game. Jika hasil tidak pasti, **jangan** hapus marker, reset status atau kirim ulang massal; eskalasi untuk rekonsiliasi. Exactly-once belum dijamin.
6. Uji checkout saat plugin lama/tidak siap atau tidak check-in; mode offline seharusnya menolak checkout baru atau menahan delivery. RCON tidak digunakan untuk delivery pada mode offline. Check-in yang sempat baru bukan jaminan plugin akan tetap tersedia setelahnya.

## 7. Uji staf dan alternatif

1. Buat akun website dan pemain **uji** untuk staf, aktifkan 2FA, lalu gunakan proses promosi Owner. Verifikasi identitas secara terpisah sebelum mengubah role. Jika akses staf dicabut, akun website yang sama kembali menjadi `CUSTOMER`; jangan menggabungkan akun.
2. Owner mendaftarkan UUID Minecraft uji utama dan alternatif yang diketahui di `/admin/staf` dengan alasan. Uji pembelian rank oleh staf dan oleh UUID alternatif yang terdaftar, hadiah rank ke staf/alternatif, serta comp dan pemeriksaan ulang sebelum dispatch. Harapan: ditolak atau ditahan sesuai tahap, dan grup staf tetap utuh.
3. Periksa grup dan inheritance LuckPerms aktual, termasuk konteks serta seluruh grup staf. Uji `freerank` tetap utuh saat grant, upgrade dan revoke. Sistem tidak dapat otomatis mengenali akun alternatif yang tidak diketahui atau tidak terdaftar; Owner perlu menjaga daftar dan meninjau risiko ini sebelum membuka penjualan.

## 8. Catatan hasil dan penanganan masalah

Buat satu catatan per skenario, tanpa rahasia:

| Tanggal/waktu | Skenario dan versi | Hasil yang diharapkan | Hasil aktual | Lulus/gagal | Tindak lanjut |
| --- | --- | --- | --- | --- | --- |
| Isi saat pengujian | Contoh: Java sebelum login, commit/JAR | Verifikasi ditolak | Isi hasil | Isi | Isi jika gagal |

Jika tes gagal:

- **Tidak bisa `/verify`:** cek pemain sudah login LoginSecurity, nama/prefix, kedua plugin aktif, waktu kode, URL HTTPS, kecocokan secret secara privat dan log. Jangan kirim kode atau secret ke orang lain.
- **Checkout ditolak:** cek profil telah diverifikasi dengan plugin baru, server default mode PLUGIN, check-in terbaru, kesiapan LoginSecurity/Floodgate, season dan gateway sandbox. Tunggu polling setelah memperbaiki konfigurasi.
- **Pembayaran berhasil tetapi delivery tertahan:** cek order dan `/admin/pengiriman`, log, antrean, marker dan keadaan penerima. Jangan otomatis memberi comp atau menekan kirim ulang saat hasil belum pasti; ikuti [runbook rekonsiliasi](docs/RUNBOOK.md).
- **Hasil tes tidak sesuai:** catat langkah, waktu dan pesan yang sudah disensor; hentikan skenario terkait. Jangan menyimpulkan lolos dari status check-in saja.

## 9. Keputusan sebelum produksi

- [ ] Semua tes yang relevan lulus pada versi dan konfigurasi yang sesuai; kegagalan ditangani dan diuji ulang.
- [ ] Owner memverifikasi akun website, UUID utama/alternatif staf yang diketahui, dan konfigurasi LuckPerms. Akun staf nyata tidak dibuat otomatis oleh panduan ini.
- [ ] Penanggung jawab dan prosedur untuk pembayaran sukses tetapi delivery tertahan sudah ditetapkan. Uji gateway sandbox dan kebijakan transaksi terlambat/sengketa sudah disepakati.
- [ ] Siapkan rencana tertulis: hentikan checkout dan plugin/polling lama, backup database serta antrean dan `delivery-intents`, uji pemulihan terisolasi, dan rekonsiliasi perintah, UUID, profil, entitlement dan delivery lama satu per satu. Jangan mengubah UUID dengan tebakan atau mass-retry.
- [ ] Pastikan monitoring, backup, rollback, keamanan jaringan, pengaturan produksi dan risiko residual telah ditinjau. Ikuti checklist lengkap [go-live](docs/GO_LIVE.md).
- [ ] Owner memberikan keputusan **go/no-go** untuk rilis. Persetujuan ini untuk rilis sistem, **bukan** persetujuan setiap pembelian.

Hanya setelah itu migrasi/pemasangan produksi dilakukan oleh operator berwenang sesuai rencana yang disetujui. Jika belum ada staging atau bukti hasil tes, statusnya tetap **belum siap produksi**.
