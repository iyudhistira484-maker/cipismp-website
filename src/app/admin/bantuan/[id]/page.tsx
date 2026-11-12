import Link from "next/link";
import { ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/guard";
import { ticketDetail } from "@/server/support";
import { formatDateTimeWIB } from "@/lib/dates";
import { AdminPageHeader, Card } from "@/components/admin/shell";
import { SupportReplyForm, CloseSupportForm } from "@/components/dashboard/support-forms";

export const metadata = { title: "Detail bantuan" };

export default async function AdminSupportDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("orders.read");
  const { id } = await params;
  const detail = await ticketDetail(id);
  if (!detail) notFound();
  const { ticket, messages } = detail;
  return (
    <>
      <Link href="/admin/bantuan" className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-accent-strong"><ArrowLeft className="size-3.5" aria-hidden /> Semua bantuan</Link>
      <AdminPageHeader title={ticket.subject} description={`Pelanggan ${ticket.username} · ${ticket.orderNumber ?? "Pertanyaan umum"} · ${ticket.status === "OPEN" ? "Terbuka" : "Ditutup"}`} actions={ticket.orderId ? <Link href={`/admin/pesanan/${ticket.orderId}`} className="text-[12px] font-semibold text-accent-strong hover:underline">Lihat pesanan terkait →</Link> : undefined} />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="conversation-heading" className="min-w-0 rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6">
          <h2 id="conversation-heading" className="flex items-center gap-2 font-display text-[17px] font-semibold text-ink"><MessageCircle className="size-4 text-accent-strong" aria-hidden /> Percakapan</h2>
          <div className="dashboard-scroll mt-4 max-h-[36rem] space-y-3 overflow-y-auto" tabIndex={0} aria-label="Pesan percakapan">{messages.map((message) => <article key={message.id} className={`rounded-2xl p-4 ${message.authorRole === "STAFF" ? "border border-[#ecdce8] bg-[#faf1f7]" : "border border-line bg-[#fdfcfd]"}`}><div className="flex flex-wrap justify-between gap-2 text-[11px]"><strong className="break-words text-ink">{message.authorRole === "STAFF" ? "Tim bantuan" : ticket.username}</strong><time className="text-muted-2" dateTime={message.createdAt.toISOString()}>{formatDateTimeWIB(message.createdAt)} WIB</time></div><p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted">{message.body}</p></article>)}</div>
        </section>
        <div className="space-y-4"><Card title="Tindak lanjut">{ticket.status === "OPEN" ? <div className="space-y-5"><SupportReplyForm id={id} staff /><div className="border-t border-line pt-4"><CloseSupportForm id={id} /></div></div> : <p className="text-[13px] text-muted">Permintaan sudah ditutup.</p>}</Card><p className="flex items-start gap-2 rounded-[18px] border border-[#ebdce9] bg-[#f9f4f9] p-4 text-[12px] leading-relaxed text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />Jangan meminta password, kode 2FA, atau data pembayaran rahasia kepada pelanggan.</p></div>
      </div>
    </>
  );
}
