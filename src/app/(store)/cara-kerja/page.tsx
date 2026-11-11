import Link from "next/link";
import type { Metadata } from "next";
import { getActiveSeason } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { formatDateWIB } from "@/lib/dates";
import { getServerStatus } from "@/server/server-status";
import { CopyButton } from "@/components/ui/copy-button";

export const metadata: Metadata = {
  title: "Cara kerja",
  description:
    "Alur pembelian rank dan kit CipiSMP: verifikasi akun, pembayaran, aktivasi akses PlayerKits, dan pengiriman otomatis ke server.",
  alternates: { canonical: "/cara-kerja" },
};

const STEPS = [
  {
    title: "Pilih produk dan periksa masa aktif",
    body: "Setiap halaman rank dan kit menampilkan nama season serta tanggal berakhirnya. Kit dibeli satu kali per pemain per season; akses PlayerKits aktif sampai season selesai dan klaim mengikuti cooldown server.",
  },
  {
    title: "Tulis username Minecraft",
    body: "Java: 3–16 karakter huruf, angka, garis bawah. Bedrock: nama Floodgate berawalan titik. Kami menampilkan kepala skin sebagai konfirmasi bahwa akun yang dimaksud benar.",
  },
  {
    title: "Bayar lewat QRIS, VA, atau e-wallet",
    body: "Transaksi dibuat di Tripay atau Midtrans. Total dihitung ulang di server, termasuk diskon dan upgrade. Halaman redirect gateway tidak pernah mengubah status pesanan.",
  },
  {
    title: "Akses server diaktifkan otomatis",
    body: "Setelah pembayaran terverifikasi, permission rank atau PlayerKits dikirim ke server. Pemain offline mendapatkannya saat login. CipiPrime dan Cipi++ diklaim di PlayerKits dengan cooldown 5 jam yang dikelola server.",

  },
];

export default async function HowItWorksPage() {
  const [season, settings, status] = await Promise.all([getActiveSeason(), getSettings(), getServerStatus()]);
  const javaAddress = status.javaPort === 25565 ? status.javaHost : `${status.javaHost}:${status.javaPort}`;
  const bedrockAddress = `${status.bedrockHost}:${status.bedrockPort}`;

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Cara kerja</p>
        <h1 className="mt-2 text-balance font-display text-h1 text-ink">
          Dari keranjang sampai akses server aktif, semuanya otomatis.
        </h1>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted">
          Tidak perlu membuat tiket atau menunggu admin online. Yang kami minta hanya dua hal: username
          Minecraft yang benar dan email aktif untuk kuitansi.
        </p>
      </div>

      <ol className="mt-10 space-y-px overflow-hidden rounded-lg border border-line bg-line">
        {STEPS.map((step, index) => (
          <li key={step.title} className="grid gap-3 bg-surface p-5 sm:grid-cols-[auto_1fr] sm:gap-6 sm:p-6">
            <span className="font-mono text-[12px] text-accent">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="text-[15.5px] font-medium text-ink">{step.title}</h2>
              <p className="mt-1.5 max-w-2xl text-pretty text-[13.5px] leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface/60 p-5">
          <h2 className="font-display text-[16px] text-ink">Cara masuk ke server</h2>
          <dl className="mt-3 space-y-3 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Java Edition</dt>
              <dd className="flex items-center gap-2">
                <code className="font-mono text-[11px] text-ink">{javaAddress}</code>
                <CopyButton value={javaAddress} compact />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Bedrock Edition</dt>
              <dd className="flex items-center gap-2">
                <code className="font-mono text-[11px] text-ink">{bedrockAddress}</code>
                <CopyButton value={bedrockAddress} compact />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-2xs leading-relaxed text-muted-2">
            Java &amp; Bedrock bermain di dunia yang sama lewat Geyser/Floodgate. Versi Paper 1.21.x.
          </p>
        </section>

        <section className="rounded-lg border border-line bg-surface/60 p-5">
          <h2 className="font-display text-[16px] text-ink">Musim dan masa aktif</h2>
          {season ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {season.name} berjalan sampai <strong className="font-medium text-ink">{formatDateWIB(season.endAt)}</strong>.
              Pembelian ditutup {season.freezeDays} hari sebelum tanggal itu.
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-muted">Belum ada season aktif.</p>
          )}
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Saat season berganti, semua rank dan kit dilepas dari akun dan harus dibeli lagi di season
            baru. Tidak ada perpanjangan otomatis, jadi tidak ada tagihan yang tidak kamu minta.
          </p>
        </section>
      </div>

      <div className="mt-8 rounded-lg border border-line p-5 text-[13px] leading-relaxed text-muted">
        <p className="font-medium text-ink">Ada masalah setelah membayar?</p>
        <p className="mt-1.5">
          Buka <Link href="/status-pesanan" className="text-accent hover:underline">status pesanan</Link>{" "}
          lalu periksa bagian pengiriman. Kalau status sudah selesai tetapi akses belum aktif, kirim nomor
          order ke{" "}
          <a href={`mailto:${settings.site.supportEmail}`} className="text-accent hover:underline">
            {settings.site.supportEmail}
          </a>
          . Solusi kami adalah pengiriman ulang, bukan pembayaran kedua.
        </p>
      </div>
    </div>
  );
}
