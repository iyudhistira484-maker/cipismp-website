import Link from "next/link";
import { ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";
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
  return (
    <div className="space-y-5">
      <Link href="/dashboard/bantuan" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-accent-strong"><ArrowLeft className="size-3.5" aria-hidden /> Semua bantuan</Link>
      <header className="rounded-[22px] border border-[#efdee8] bg-[#fcf4f9] p-5 sm:p-6"><p className="eyebrow">Percakapan bantuan</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="min-w-0 break-words font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-tight text-ink">{ticket.subject}</h1><Badge tone={ticket.status === "OPEN" ? "accent" : "neutral"}>{ticket.status === "OPEN" ? "Terbuka" : "Ditutup"}</Badge></div><p className="mt-2 text-[12px] text-muted">{ticket.orderNumber ? `Pesanan ${ticket.orderNumber}` : "Pertanyaan umum"}</p></header>
      <section aria-label="Percakapan" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6"><div className="mb-4 flex items-center gap-2"><MessageCircle className="size-4 text-accent-strong" aria-hidden /><h2 className="font-display text-[17px] text-ink">Percakapan</h2></div><div className="dashboard-scroll max-h-[32rem] space-y-3 overflow-y-auto" tabIndex={0} aria-label="Pesan percakapan">{messages.map((message) => <article key={message.id} className={`rounded-2xl p-4 ${message.authorRole === "STAFF" ? "border border-[#ecdce8] bg-[#faf1f7]" : "border border-line bg-[#fdfcfd]"}`}><div className="flex flex-wrap justify-between gap-2 text-[11px]"><strong className="text-ink">{message.authorRole === "STAFF" ? "Tim CipiSMP" : "Kamu"}</strong><time className="text-muted-2" dateTime={message.createdAt.toISOString()}>{formatDateTimeWIB(message.createdAt)} WIB</time></div><p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted">{message.body}</p></article>)}</div></section>
      {ticket.status === "OPEN" ? <section className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6"><SupportReplyForm id={id} /><p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />Jangan bagikan password, kode 2FA, atau data pembayaran rahasia.</p></section> : <div className="rounded-[20px] border border-line bg-white p-5 text-[13px] leading-relaxed text-muted">Permintaan ini sudah ditutup. Jika masih membutuhkan bantuan, buat <Link href="/dashboard/bantuan" className="font-semibold text-accent-strong hover:underline">permintaan baru</Link>.</div>}
    </div>
  );
}
