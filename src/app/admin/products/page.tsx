import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, button, Card, Empty, link, PageHeader, table } from "@/components/ui";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { createProductAction } from "../actions";
import { ProductFields } from "./product-fields";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  await requireStaff();
  const products = await db.product.findMany({ orderBy: [{ active: "desc" }, { code: "asc" }], include: { _count: { select: { lots: true } } } });

  return (
    <>
      <PageHeader title="Products" subtitle="What NeoRegen sells. Every lot belongs to one product." />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div>
          {products.length === 0 ? (
            <Empty>No products yet. Add the first one to start creating lots.</Empty>
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className="bg-slate-50">
                  <tr>
                    <th className={table.th}>Code</th>
                    <th className={table.th}>Name</th>
                    <th className={table.th}>Storage</th>
                    <th className={table.th}>Lots</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className={table.td}>
                        <Link href={`/admin/products/${p.id}`} className={`${link} font-mono`}>
                          {p.code}
                        </Link>
                      </td>
                      <td className={table.td}>
                        {p.name} {p.active ? null : <Badge>Inactive</Badge>}
                      </td>
                      <td className={`${table.td} text-slate-600`}>{p.storage ?? "—"}</td>
                      <td className={`${table.td} tabular-nums`}>{p._count.lots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Card>
          <h2 className="mb-4 text-base font-semibold text-ink">Add a product</h2>
          <ActionForm action={createProductAction} resetOnSuccess className="space-y-4">
            <ProductFields />
            <SubmitButton className={button.primary}>Add product</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
