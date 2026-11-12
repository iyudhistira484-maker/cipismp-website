import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/server/auth/guard";
import { ticketDetail } from "@/server/support";
import { formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { SupportReplyForm } from "@/components/dashboard/support-forms";

export const metadata = { title: "Percakapan bantuan", robots: { index: false, follow: false } };

export default async function SupportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireCustomer("/dashboard/bantuan");
  const { id } = await params;
  const detail = await ticketDetail(id, viewer.user.id);
  if (!detail) notFound();
  const { ticket, messages } = detail;
  return <div className="space-y-6"><Link href="/dashboard/bantuan" className="text-[12px] text-muted hover:text-accent">← Semua bantuan</Link><header><p className="eyebrow">Percakapan bantuan</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="font-display text-h2 text-ink">{ticket.subject}</h1><Badge tone={ticket.status === "OPEN" ? "accent" : "neutral"}>{ticket.status === "OPEN" ? "Terbuka" : "Ditutup"}</Badge></div><p className="mt-2 text-[12px] text-muted">{ticket.orderNumber ? `Pesanan ${ticket.orderNumber}` : "Pertanyaan umum"}</p></header>
    <section aria-label="Percakapan" className="dashboard-scroll max-h-[32rem] space-y-3 overflow-y-auto rounded-xl border border-line bg-white p-4" tabIndex={0}>{messages.map((message) => <article key={message.id} className={`rounded-lg p-4 ${message.authorRole === "STAFF" ? "bg-surface-2" : "border border-line"}`}><div className="flex flex-wrap justify-between gap-2 text-[11px]"><strong className="text-ink">{message.authorRole === "STAFF" ? "Tim CipiSMP" : "Kamu"}</strong><time className="text-muted-2" dateTime={message.createdAt.toISOString()}>{formatDateTimeWIB(message.createdAt)} WIB</time></div><p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted">{message.body}</p></article>)}</section>
    {ticket.status === "OPEN" ? <section className="rounded-xl border border-line bg-white p-5"><SupportReplyForm id={id} /></section> : <p className="text-[13px] text-muted">Permintaan ini sudah ditutup. Jika masih membutuhkan bantuan, buat permintaan baru.</p>}
  </div>;
}
