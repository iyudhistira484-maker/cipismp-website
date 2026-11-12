import { requireStaff } from "@/server/auth/guard";
import { listCouponsForAdmin } from "@/server/admin/queries";
import { listSeasons } from "@/server/catalog";
import { formatRp } from "@/lib/money";
import { formatDateWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { CouponForm, ToggleCouponButton } from "@/components/admin/admin-forms";

export const metadata = { title: "Kupon" };

export default async function AdminCouponsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireStaff("coupons.write");
  const params = await searchParams;
  const [coupons, seasons] = await Promise.all([listCouponsForAdmin(), listSeasons()]);
  const editing = params.edit ? coupons.find((coupon) => coupon.id === params.edit) : undefined;
  const seasonNames = new Map(seasons.map((season) => [season.id, season.name]));

  return (
    <>
      <AdminPageHeader title="Kupon" description="Diskon tidak pernah membuat total negatif. Kuota dan batas per pembeli ditegakkan di server." />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Table head={["Kode", "Diskon", "Season", "Kuota", "Terpakai", "Total diskon", "Periode", "Status", "Aksi"]} empty={coupons.length === 0}>
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <Td className="font-mono text-ink">{coupon.code}</Td>
              <Td className="min-w-40 align-top text-2xs">
                <p className="text-ink">
                  {coupon.type === "PERCENT" ? `${coupon.value}%` : formatRp(coupon.value)} · ≥ {formatRp(coupon.minSubtotalIdr)}
                </p>
                <p className="mt-1 text-muted-2">Cakupan: {coupon.eligibleItemsOnly ? "jenis terpilih" : "seluruh keranjang"}</p>
                {coupon.tiers.map((tier, index) => (
                  <p key={`${coupon.id}-tier-${index}`} className="mt-1 text-muted-2">
                    {tier.type === "PERCENT" ? `${tier.value}%` : formatRp(tier.value)} · ≥ {formatRp(tier.minSubtotalIdr)}
                  </p>
                ))}
              </Td>
              <Td className="text-2xs">{coupon.seasonId ? (seasonNames.get(coupon.seasonId) ?? "Season khusus") : "Semua season"}</Td>
              <Td className="tabular-nums">{coupon.maxRedemptions ?? "∞"}</Td>
              <Td className="tabular-nums">{coupon.redeemedCount}</Td>
              <Td className="tabular-nums">{formatRp(coupon.discountGivenIdr)}</Td>
              <Td className="text-2xs">
                {coupon.startsAt ? formatDateWIB(coupon.startsAt) : "kapan saja"} — {coupon.endsAt ? formatDateWIB(coupon.endsAt) : "tanpa batas"}
              </Td>
              <Td>
                <Badge tone={coupon.active ? "success" : "neutral"}>{coupon.active ? "Aktif" : "Nonaktif"}</Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <a href={`/admin/kupon?edit=${coupon.id}`} className="text-2xs text-muted underline-offset-2 hover:text-accent hover:underline">
                    Ubah
                  </a>
                  <ToggleCouponButton couponId={coupon.id} active={coupon.active} />
                </div>
              </Td>
            </tr>
          ))}
        </Table>

        <Card title={editing ? `Ubah ${editing.code}` : "Kupon baru"}>
          <CouponForm
            coupon={
              editing
                ? {
                    id: editing.id,
                    code: editing.code,
                    type: editing.type,
                    value: editing.value,
                    minSubtotalIdr: editing.minSubtotalIdr,
                    tiers: editing.tiers,
                    seasonId: editing.seasonId,
                    maxRedemptions: editing.maxRedemptions,
                    maxPerUser: editing.maxPerUser,
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
