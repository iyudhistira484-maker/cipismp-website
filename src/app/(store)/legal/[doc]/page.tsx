import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LEGAL_DOCS, findLegalDoc } from "@/content/legal";
import { getSettings } from "@/server/settings";
import { formatDateWIB } from "@/lib/dates";
import { Alert } from "@/components/ui/feedback";

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const found = findLegalDoc(doc);
  if (!found) return { title: "Dokumen tidak ditemukan" };
  return {
    title: found.title,
    description: found.summary,
    alternates: { canonical: `/legal/${found.slug}` },
  };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const found = findLegalDoc(doc);
  if (!found) notFound();
  const settings = await getSettings();
  const version = settings.legal[found.versionKey];

  return (
    <div className="container-page max-w-3xl py-12 lg:py-16">
      <nav aria-label="Breadcrumb" className="text-[12.5px] text-muted-2">
        <Link href="/" className="hover:text-ink">Beranda</Link>
        <span aria-hidden> / </span>
        <span className="text-muted">Legal</span>
      </nav>
      <h1 className="mt-4 font-display text-h1 text-ink">{found.title}</h1>
      <p className="mt-3 text-pretty text-[14.5px] leading-relaxed text-muted">{found.summary}</p>
      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-y border-line py-3 text-2xs text-muted-2">
        <div className="flex gap-1.5"><dt>Versi</dt><dd className="font-mono text-[10px] text-muted">{version}</dd></div>
        <div className="flex gap-1.5"><dt>Berlaku sejak</dt><dd className="text-muted">{formatDateWIB(new Date(`${settings.legal.updatedAt}T00:00:00+07:00`))}</dd></div>
        <div className="flex gap-1.5"><dt>Bahasa</dt><dd className="text-muted">Indonesia</dd></div>
      </dl>

      <div className="mt-8 space-y-8">
        {found.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-[18px] text-ink">{section.heading}</h2>
            <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-muted">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
              {section.list ? (
                <ul className="list-disc space-y-1.5 pl-5">
                  {section.list.map((item) => (
                    <li key={item.slice(0, 40)}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <Alert tone="info" className="mt-10" title="Catatan versi draf">
        Dokumen ini adalah draf teknis yang disusun agar transparan dan sesuai praktik toko digital. Sebelum
        peluncuran produksi, teks ini wajib direview penasihat hukum.
      </Alert>

      <div className="mt-6 flex flex-wrap gap-4 text-[13px] text-muted">
        {LEGAL_DOCS.filter((item) => item.slug !== found.slug).map((item) => (
          <Link key={item.slug} href={`/legal/${item.slug}`} className="hover:text-accent">
            {item.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
