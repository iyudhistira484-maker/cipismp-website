import { requireStaff } from "@/server/auth/guard";
import { listProductsForAdmin, productForEdit } from "@/server/admin/queries";
import { formatRp } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { DeleteProductButton, ProductForm } from "@/components/admin/admin-forms";

export const metadata = { title: "Produk" };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireStaff("products.write");
  const params = await searchParams;
  const products = await listProductsForAdmin();
  const editing = params.edit ? await productForEdit(params.edit) : undefined;

  return (
    <>
      <AdminPageHeader
        title="Produk"
        description="Harga dan ketersediaan bisa diubah kapan saja. Perubahan harga tidak mengubah order yang sudah dibuat."
      />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Table head={["Produk", "Jenis", "Harga", "Status", "Terjual", "Aksi"]} empty={products.length === 0}>
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-surface-2/40">
              <Td>
                <span className="block text-ink">{product.name}</span>
                <span className="block font-mono text-2xs text-muted-2">/{product.slug} · tier {product.tier}</span>
              </Td>
              <Td>{product.type === "RANK" ? "Rank" : "Kit"}</Td>
              <Td className="tabular-nums text-ink">{formatRp(product.priceIdr)}</Td>
              <Td>
                <Badge tone={product.deletedAt ? "danger" : product.status === "PUBLISHED" ? "success" : "neutral"}>
                  {product.deletedAt ? "Dihapus" : product.status === "PUBLISHED" ? "Tayang" : "Draft"}
                </Badge>
              </Td>
              <Td className="tabular-nums">{product.soldCount}</Td>
              <Td>
                <a href={`/admin/produk?edit=${product.id}`} className="text-2xs text-muted underline-offset-2 hover:text-accent hover:underline">
                  Ubah
                </a>
                {!product.deletedAt ? <span className="ml-2"><DeleteProductButton productId={product.id} name={product.name} /></span> : null}
              </Td>
            </tr>
          ))}
        </Table>

        <Card
          title={editing ? `Ubah ${editing.name}` : "Produk baru"}
          description={editing ? "Perubahan berlaku langsung di storefront." : "Produk baru dibuat sebagai draft sampai kamu ubah statusnya."}
        >
          <ProductForm
            product={
              editing
                ? {
                    id: editing.id,
                    type: editing.type,
                    slug: editing.slug,
                    name: editing.name,
                    tagline: editing.tagline,
                    description: editing.description,
                    priceIdr: editing.priceIdr,
                    tier: editing.tier,
                    maxPerSeason: editing.maxPerSeason,
                    cooldownHours: editing.cooldownHours,
                    sortOrder: editing.sortOrder,
                    perks: editing.perks.join("\n"),
                    status: editing.status,
                  }
                : undefined
            }
          />
        </Card>
      </div>
    </>
  );
}
