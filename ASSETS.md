# Aset visual & lisensi

Aset di repo ini dibuat untuk proyek, disediakan pemilik server, atau digunakan sesuai sumber
serta ketentuan yang dicatat di bawah. Hak atas logo CipiSMP tetap pada pemilik server; hak
atas aset Minecraft tetap pada Mojang Studios/Microsoft. Situs ini adalah layanan komunitas
CipiSMP; keterangan non-afiliasi ada di Syarat Layanan, email transaksi, dan invoice. Footer
toko menampilkan “All rights reserved.”

## 1. Logo & ikon merek

| Aset | Berkas | Lisensi |
| --- | --- | --- |
| Logo CipiSMP | `public/images/cipismp-logo.jpeg` | Disediakan pemilik server untuk identitas toko |
| Wordmark teks pendamping | `src/components/art/item-art.tsx` | Milik proyek |
| Favicon / ikon aplikasi | `src/app/icon.svg` | Milik proyek |
| Gambar OG default | `src/app/opengraph-image.tsx` (dibuat runtime oleh Next) | Milik proyek |
| Gambar OG per produk | `src/app/(store)/{rank,kit}/[slug]/opengraph-image.tsx` + `src/components/art/og-product.tsx` | Milik proyek |

Logo di header, beranda, dan footer memakai gambar yang diberikan pemilik server. Palet
antarmuka menggunakan putih, rose, dan sentuhan lavender agar serasi dengan logo. Favicon
memakai monogram sederhana dalam palet yang sama.

## 2. Ikon item Minecraft

- Berkas lokal: `public/images/minecraft/26.3/items/` (40 PNG transparan untuk semua item kit
  yang saat ini ditampilkan, ditambah ikon fallback). Kartu kit, halaman detail kit, dan
  ringkasan dashboard memakai sprite inventaris ini, bukan ilustrasi AI atau SVG buatan.
- Sumber gambar: [VanillaTymeServers/mc-items](https://github.com/VanillaTymeServers/mc-items),
  dipatok pada commit `70ffec384e497f8c31125b541c79c96fe7905c16`. Arsip commit tersebut
  diunduh ulang dan checksum SHA-256 seluruh 40 PNG lokal dicocokkan dengan arsip. Sprite
  dirender dari aset Minecraft Java 26.3 dengan WikiRenderer 2.6; repo sumber mencatat kredit
  renderer kepada glisco, Pigicial, dan Skittlq.
- Penamaan ID dan alias berada di `src/lib/minecraft-item-icon-ids.json` dan
  `src/lib/minecraft-item-icons.ts` (`bed` → `red_bed`, `boat` → `oak_boat`). ID yang belum
  tersedia memakai ikon barrier Minecraft sebagai fallback, bukan ikon buatan.
- Repo sumber menyertakan MIT untuk **source code saja** serta `NOTICE.md` yang menyatakan
  ikon/nama berasal dari Minecraft, hak cipta Mojang Studios/Microsoft, dan tidak tercakup
  MIT. Arsip sumber juga meminta disclaimer: “NOT AN OFFICIAL MINECRAFT PRODUCT. NOT
  APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.” Keterangan non-afiliasi tersedia di
  Syarat Layanan, email transaksi, dan invoice; footer toko menampilkan “All rights reserved.”
- **Hak redistribusi/komersial belum diverifikasi.** Tautan ke Minecraft Usage Guidelines
  dicatat oleh repo sumber, tetapi ketentuan resminya belum dapat ditinjau di lingkungan ini
  dan tidak ada izin komersial eksplisit di lisensi MIT. Jangan anggap pencatatan sumber atau
  disclaimer sebagai izin; sebelum go-live, pemilik harus memastikan penggunaan sprite pada
  toko komersial memang diizinkan atau menggantinya dengan aset berlisensi komersial yang
  jelas. Tidak ada source code dari repositori mc-items yang dipakai di aplikasi.

## 3. Font

| Font | Paket | Lisensi |
| --- | --- | --- |
| Bricolage Grotesque (display) | `@fontsource-variable/bricolage-grotesque` | SIL Open Font License 1.1 |
| Instrument Sans (teks) | `@fontsource-variable/instrument-sans` | SIL Open Font License 1.1 |

Font di-self-host lewat `@fontsource` (diimpor di `src/app/globals.css`), di-subset oleh
paketnya, dan tidak memanggil Google Fonts saat runtime. Data teknis memakai stack monospace
sistem agar tetap mudah dibaca.

## 4. Ikon antarmuka

- Satu set saja: **Lucide** (`lucide-react`), lisensi ISC.
- Tidak ada emoji sebagai ikon, tidak ada ikon campuran dari beberapa set.

## 5. Ilustrasi produk

- Tujuh ilustrasi raster khusus produk rank masih berada di `public/images/products/`: empat
  rank aktif (`star-cipi`, `milk-cipi`, `pop-cipi`, `cute-cipi`) dan tiga rank arsip (`iron`,
  `gold`, `diamond`). Ilustrasi AI hanya dipakai untuk identitas rank, bukan untuk barang game.
- Ilustrasi AI kit Starter, Builder, dan Explorer sudah dihapus. Kartu kit menampilkan ikon
  inventaris Minecraft yang sesuai dengan isi kit.
- Pemetaan gambar rank dan fallback ada di `src/lib/product-artwork.ts`. Form admin hanya
  menawarkan ilustrasi tersebut untuk rank; isi kit tetap menggunakan ikon item aktual.

## 6. Video latar hero

- Halaman beranda merujuk video Minecraft Northern Light dari MotionBGS:
  `https://motionbgs.com/media/9360/minecraft-northern-light.960x540.mp4` (tautan diberikan pengguna).
- Video dimuat langsung dari host tersebut, tidak disalin ke repo. Komponen dekoratif diputar
  tanpa suara, inline dan loop; pada `prefers-reduced-motion` video tidak dimuat. Gradien CSS
  tetap menjadi fallback bila video gagal atau jaringan tidak tersedia.
- Izin penggunaan/redistribusi dan ketersediaan URL belum diverifikasi. Konfirmasikan hak
  penggunaan sebelum go-live; untuk produksi, pertimbangkan salinan/host yang dikendalikan
  proyek jika lisensi dan ukuran berkas mengizinkan.

## 7. Screenshot gameplay beranda

- Tiga screenshot CipiSMP disediakan pengguna, diubah ukurannya dan dioptimalkan menjadi WebP, lalu disimpan lokal agar galeri tidak bergantung pada image host eksternal: `public/images/gameplay/season-one-spawn.webp` (papan CipiSMP Season 1), `spawn-market.webp` (panorama area spawn dan bangunan), dan `forest-path.webp` (jalur batu di antara pepohonan).
- Galeri memakai deskripsi adegan faktual, bukan klaim fitur atau testimoni. Hak cipta aset Minecraft tetap pada Mojang Studios/Microsoft; hak penggunaan komersial screenshot belum diverifikasi. Pastikan izin sebelum go-live.

## 8. Menambah aset baru

Jika menambahkan aset pihak ketiga:

1. Pastikan sumber dan hak penggunaannya jelas untuk konteks proyek ini; jangan menganggap
   semua aset berlisensi MIT hanya karena kode sumbernya berlisensi MIT.
2. Simpan berkas sumber di `public/` atau `src/assets/` dengan nama deskriptif.
3. Tambahkan sumber/penulis, versi, hak/lisensi, serta tautan ketentuannya ke dokumen ini.
4. Untuk font, gunakan paket `@fontsource` (self-host), bukan CDN.
