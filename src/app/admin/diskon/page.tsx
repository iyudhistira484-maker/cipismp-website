import { requireStaff } from "@/server/auth/guard";
import { listAutomaticDiscountsForAdmin } from "@/server/admin/queries";
import { listSeasons } from "@/server/catalog";
import { formatDateWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { AutomaticDiscountForm, ToggleAutomaticDiscountButton } from "@/components/admin/admin-forms";

export const metadata = { title: "Diskon otomatis" };

export default async function AdminAutomaticDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireStaff("coupons.write");
  const params = await searchParams;
  const [discounts, seasons] = await Promise.all([listAutomaticDiscountsForAdmin(), listSeasons()]);
  const editing = params.edit ? discounts.find((discount) => discount.id === params.edit) : undefined;
  const seasonNames = new Map(seasons.map((season) => [season.id, season.name]));

  return (
    <>
      <AdminPageHeader
        title="Diskon otomatis"
        description="Promo ini diterapkan tanpa kode saat keranjang memenuhi syarat. Kupon tetap tersedia di halaman Kupon; kedua jenis diskon tidak ditumpuk."
      />

      {discounts.length === 0 ? (
        <Alert tone="info" className="mb-4">
          Belum ada promo otomatis. Buat aturan di samping untuk mulai memberi diskon langsung di keranjang.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Table head={["Nama", "Potongan", "Syarat", "Season", "Periode", "Status", "Aksi"]} empty={discounts.length === 0}>
          {discounts.map((discount) => (
            <tr key={discount.id}>
              <Td className="min-w-36 font-medium text-ink">{discount.name}</Td>
              <Td className="whitespace-nowrap text-ink">
                {discount.type === "PERCENT" ? `${discount.value}%` : formatRp(discount.value)}
              </Td>
              <Td className="min-w-36 text-2xs">
                <p>Belanja ≥ {formatRp(discount.minSubtotalIdr)}</p>
                <p>Cakupan: {discount.eligibleItemsOnly ? "jenis terpilih" : "seluruh keranjang"}</p>
                {discount.rankOnly ? <p className="mt-1">Keranjang berisi rank</p> : null}
                {discount.kitOnly ? <p className="mt-1">Keranjang berisi kit</p> : null}
              </Td>
              <Td className="text-2xs">
                {discount.seasonId ? (seasonNames.get(discount.seasonId) ?? "Season khusus") : "Semua season"}
              </Td>
              <Td className="min-w-40 text-2xs">
                {discount.startsAt ? formatDateWIB(discount.startsAt) : "kapan saja"} — {discount.endsAt ? formatDateWIB(discount.endsAt) : "tanpa batas"}
              </Td>
              <Td>
                <Badge tone={discount.active ? "success" : "neutral"}>{discount.active ? "Aktif" : "Nonaktif"}</Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <a href={`/admin/diskon?edit=${discount.id}`} className="text-2xs text-muted underline-offset-2 hover:text-accent hover:underline">
                    Ubah
                  </a>
                  <ToggleAutomaticDiscountButton discountId={discount.id} active={discount.active} />
                </div>
              </Td>
            </tr>
          ))}
        </Table>

        <Card title={editing ? `Ubah ${editing.name}` : "Promo otomatis baru"}>
          <AutomaticDiscountForm
            key={editing?.id ?? "new"}
            discount={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    type: editing.type,
                    value: editing.value,
                    minSubtotalIdr: editing.minSubtotalIdr,
                    seasonId: editing.seasonId,
                    startsAt: editing.startsAt,
                    endsAt: editing.endsAt,
                    rankOnly: editing.rankOnly,
                    kitOnly: editing.kitOnly,
                    eligibleItemsOnly: editing.eligibleItemsOnly,
                    active: editing.active,
                  }
                : undefined
            }
            seasons={seasons.map(({ id, name, status }) => ({ id, name, status }))}
          />
        </Card>
      </div>
    </>
  );
}
