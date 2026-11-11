# Aset visual & lisensi

Semua aset di repo ini dibuat sendiri atau berlisensi bebas. Tidak ada gambar hasil
pencarian, tangkapan layar pihak lain, atau aset berlisensi tidak jelas.

## 1. Logo & ikon merek

| Aset | Berkas | Lisensi |
| --- | --- | --- |
| Wordmark "CipiSMP" (tipografi, bukan gambar) | `src/components/store/site-header.tsx`, `src/components/store/site-footer.tsx` | Milik proyek |
| Favicon / ikon aplikasi | `src/app/icon.svg` | Milik proyek |
| Gambar OG default | `src/app/opengraph-image.tsx` (dibuat runtime oleh Next) | Milik proyek |
| Gambar OG per produk | `src/app/(store)/{rank,kit}/[slug]/opengraph-image.tsx` + `src/components/art/og-product.tsx` — nama produk, tagline, 3 keunggulan, harga, sisa season, warna tier | Milik proyek |

Logo sengaja tipografis: huruf dari font display yang sudah di-self-host, tanpa maskot
atau ilustrasi tambahan. Favicon memakai bentuk "chestplate" sederhana dengan aksen amber.

## 2. Sprite item Minecraft

- Berkas: `src/components/art/item-art.tsx`
- 22 sprite item 12×12 (berlian, emas, besi, makanan, enchant, dsb.) digambar manual
  sebagai SVG inline dari bentuk geometri sederhana; tidak menyalin tekstur Mojang.
- Badge rank: `RankBadge` di berkas yang sama, bentuk perisai + garis tier.
- Lisensi: milik proyek, boleh dipakai ulang di dalam proyek ini.

## 3. Font

| Font | Paket | Lisensi |
| --- | --- | --- |
| Bricolage Grotesque (display) | `@fontsource-variable/bricolage-grotesque` | SIL Open Font License 1.1 |
| Instrument Sans (teks) | `@fontsource-variable/instrument-sans` | SIL Open Font License 1.1 |
| Silkscreen (aksen kecil, angka/pixel) | `@fontsource/silkscreen` | SIL Open Font License 1.1 |

Font di-self-host lewat `@fontsource` (diimpor di `src/app/layout.tsx`), di-subset oleh
paketnya, dan tidak memanggil Google Fonts saat runtime. Silkscreen hanya dipakai untuk
label kecil (mis. kode verifikasi), tidak untuk teks isi.

## 4. Ikon antarmuka

- Satu set saja: **Lucide** (`lucide-react`), lisensi ISC.
- Tidak ada emoji sebagai ikon, tidak ada ikon campuran dari beberapa set.

## 5. Ilustrasi & gambar lain

- Sepuluh ilustrasi raster orisinal untuk kartu katalog ada di `public/images/products/`:
  empat rank aktif (`star-cipi`, `milk-cipi`, `pop-cipi`, `cute-cipi`), tiga kit
  (`starter`, `builder`, `explorer`), serta tiga ilustrasi arsip untuk rank lama
  (`iron`, `gold`, `diamond`). Dibuat khusus untuk proyek dengan generasi AI, bergaya voxel
  generik; bukan tangkapan layar atau tekstur game pihak lain. Dashboard admin dapat memilih
  ilustrasi kartu dari daftar lokal. Pemetaan/fallback ada di `src/lib/product-artwork.ts`.
- Tangkapan layar di dokumentasi (bila ada) dibuat dari aplikasi ini sendiri.

## 6. Menambah aset baru

Jika menambahkan aset pihak ketiga:

1. Pastikan lisensinya mengizinkan penggunaan komersial dan modifikasi.
2. Simpan berkas sumber di `public/` atau `src/assets/` dengan nama deskriptif.
3. Tambahkan baris baru di tabel di atas: berkas, sumber/penulis, lisensi, tautan lisensi.
4. Untuk font, gunakan paket `@fontsource` (self-host), bukan CDN.
