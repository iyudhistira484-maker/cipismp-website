import Link from "next/link";
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
  return <><Link href="/admin/bantuan" className="text-[12px] text-muted hover:text-accent">← Semua bantuan</Link><div className="mt-3"><AdminPageHeader title={ticket.subject} description={`Pelanggan ${ticket.username} · ${ticket.orderNumber ?? "Pertanyaan umum"} · ${ticket.status === "OPEN" ? "Terbuka" : "Ditutup"}`} /></div>
    {ticket.orderId ? <Link href={`/admin/pesanan/${ticket.orderId}`} className="mb-4 inline-block text-[12px] text-accent-strong hover:underline">Lihat pesanan terkait →</Link> : null}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"><section aria-label="Percakapan" className="dashboard-scroll max-h-[36rem] space-y-3 overflow-y-auto rounded-xl border border-line bg-white p-4" tabIndex={0}>{messages.map((message) => <article key={message.id} className={`rounded-lg p-4 ${message.authorRole === "STAFF" ? "bg-surface-2" : "border border-line"}`}><div className="flex flex-wrap justify-between gap-2 text-[11px]"><strong className="text-ink">{message.authorRole === "STAFF" ? "Tim bantuan" : ticket.username}</strong><time className="text-muted-2" dateTime={message.createdAt.toISOString()}>{formatDateTimeWIB(message.createdAt)} WIB</time></div><p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted">{message.body}</p></article>)}</section><Card title="Tindak lanjut">{ticket.status === "OPEN" ? <div className="space-y-5"><SupportReplyForm id={id} staff /><div className="border-t border-line pt-4"><CloseSupportForm id={id} /></div></div> : <p className="text-[13px] text-muted">Permintaan sudah ditutup.</p>}</Card></div>
  </>;
}
