import Link from "next/link";
import { requireStaff } from "@/server/auth/guard";
import { staffNotifications } from "@/server/notifications";
import { formatDateTimeWIB } from "@/lib/dates";
import { AdminPageHeader } from "@/components/admin/shell";

export const metadata = { title: "Notifikasi operasional" };

export default async function AdminNotifications() {
  const viewer = await requireStaff("orders.read");
  const notices = await staffNotifications(viewer.user.role);
  return <><AdminPageHeader title="Notifikasi operasional" description="50 pemberitahuan terbaru sesuai izin akun. Riwayat ini dibagikan kepada staf dan tidak menandai pesan sebagai selesai." />{notices.length ? <ul className="dashboard-scroll max-h-[42rem] overflow-y-auto rounded-[20px] border border-line bg-white shadow-card" aria-label="Notifikasi operasional" tabIndex={0}>{notices.map((notice) => <li key={notice.id} className="border-b border-line p-4 last:border-0"><div className="flex flex-wrap justify-between gap-2"><p className="text-[13px] font-semibold text-ink">{notice.title}</p><time className="text-[11px] text-muted-2" dateTime={notice.createdAt.toISOString()}>{formatDateTimeWIB(notice.createdAt)} WIB</time></div><p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted">{notice.body}</p>{notice.href ? <Link href={notice.href} className="mt-2 inline-block text-[12px] font-semibold text-accent-strong hover:underline">Lihat detail →</Link> : null}</li>)}</ul> : <p className="rounded-[20px] border border-dashed border-line bg-white p-5 text-[13px] text-muted">Belum ada notifikasi operasional yang dapat dilihat akun ini.</p>}</>;
}
