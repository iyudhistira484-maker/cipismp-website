import { requireStaff } from "@/server/auth/guard";
import { listSeasonsForAdmin } from "@/server/admin/queries";
import { formatDateWIB, formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { SeasonForm, SeasonTransitionPanel } from "@/components/admin/admin-forms";

export const metadata = { title: "Season" };

export default async function AdminSeasonPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireStaff("seasons.write");
  const params = await searchParams;
  const seasons = await listSeasonsForAdmin();
  const editing = params.edit ? seasons.find((season) => season.id === params.edit) : undefined;

  return (
    <>
      <AdminPageHeader
        title="Season"
        description="Rank dan kit hanya berlaku di season yang sedang aktif. Tidak ada carry-over dan tidak ada refund saat season berakhir."
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Table head={["Season", "Status", "Periode", "Freeze", "Entitlement aktif", "Aksi"]} empty={seasons.length === 0}>
            {seasons.map((season) => (
              <tr key={season.id}>
                <Td>
                  <span className="block text-ink">{season.name}</span>
                  <span className="block font-mono text-2xs text-muted-2">{season.slug}</span>
                </Td>
                <Td>
                  <Badge tone={season.status === "ACTIVE" ? "success" : season.status === "UPCOMING" ? "info" : "neutral"}>
                    {season.status}
                  </Badge>
                </Td>
                <Td className="text-2xs">
                  {formatDateWIB(season.startAt)} — {formatDateWIB(season.endAt)}
                </Td>
                <Td className="tabular-nums">{season.freezeDays} hari</Td>
                <Td className="tabular-nums text-ink">{season.activeEntitlements}</Td>
                <Td>
                  <a href={`/admin/season?edit=${season.id}`} className="text-2xs text-muted underline-offset-2 hover:text-accent hover:underline">
                    Ubah
                  </a>
                </Td>
              </tr>
            ))}
          </Table>

          <Card title="Transisi season" description="Simulasikan dulu, lalu eksekusi. Keduanya tercatat sebagai job idempoten.">
            <SeasonTransitionPanel
              seasons={seasons.map((season) => ({
                id: season.id,
                name: season.name,
                status: season.status,
                endAt: season.endAt.toISOString(),
              }))}
            />
          </Card>

          {seasons.some((season) => season.status === "ENDED" && season.endedAt) ? (
            <p className="text-2xs text-muted-2">
              Season terakhir berakhir:{" "}
              {formatDateTimeWIB(seasons.find((season) => season.status === "ENDED" && season.endedAt)!.endedAt!)}.
            </p>
          ) : null}
        </div>

        <Card
          title={editing ? `Ubah ${editing.name}` : "Season baru"}
          description={editing ? "Gunakan panel transisi untuk mengakhiri season, bukan dengan mengubah status di sini." : "Buat season berikutnya lebih awal sebagai UPCOMING."}
        >
          <SeasonForm
            season={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    slug: editing.slug,
                    startAt: editing.startAt,
                    endAt: editing.endAt,
                    freezeDays: editing.freezeDays,
                    status: editing.status,
                    notes: editing.notes,
                  }
                : undefined
            }
          />
        </Card>
      </div>
    </>
  );
}
