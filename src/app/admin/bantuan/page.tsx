import Link from "next/link";
import { requireStaff } from "@/server/auth/guard";
import { staffTickets } from "@/server/support";
import { formatDateTimeWIB } from "@/lib/dates";
import { AdminPageHeader, Table, Td } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/dashboard/pagination";

export const metadata = { title: "Bantuan" };

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await requireStaff("orders.read");
  const params = await searchParams;
  const tickets = await staffTickets(params.cursor);
  return <><AdminPageHeader title="Bantuan pelanggan" description="Tinjau dan balas permintaan pelanggan. Jangan meminta kata sandi atau kode 2FA." /><Table head={["Permintaan", "Pelanggan", "Pesanan", "Status", "Pembaruan"]} empty={!tickets.items.length}>{tickets.items.map((ticket) => <tr key={ticket.id}><Td><Link href={`/admin/bantuan/${ticket.id}`} className="font-medium text-ink hover:text-accent">{ticket.subject}</Link></Td><Td>{ticket.username}</Td><Td>{ticket.orderNumber ?? "Umum"}</Td><Td><Badge tone={ticket.status === "OPEN" ? "accent" : "neutral"}>{ticket.status === "OPEN" ? "Terbuka" : "Ditutup"}</Badge></Td><Td>{formatDateTimeWIB(ticket.updatedAt)} WIB</Td></tr>)}</Table>{!tickets.items.length && params.cursor ? <Link href="/admin/bantuan" className="mt-3 inline-block text-[12px] text-accent-strong hover:underline">Lihat permintaan terbaru</Link> : null}<p className="mt-2 text-2xs text-muted-2">20 permintaan per halaman; urutan dapat berubah saat ada balasan.</p><Pagination path="/admin/bantuan" parameter="cursor" previous={tickets.previous} next={tickets.next} label="Halaman bantuan pelanggan" /></>;
}
