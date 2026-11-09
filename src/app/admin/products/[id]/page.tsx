import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { button, Card, link, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { updateProductAction } from "../../actions";
import { ProductFields } from "../product-fields";

export const metadata: Metadata = { title: "Edit product" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });
  if (!product) notFound();

  return (
    <>
      <Link href="/admin/products" className={`${link} text-sm`}>
        ← Products
      </Link>
      <div className="mt-3">
        <PageHeader title={product.name} subtitle={<span className="font-mono">{product.code}</span>} />
      </div>
      <Card className="max-w-xl">
        <ActionForm action={updateProductAction.bind(null, product.id)} className="space-y-4">
          <ProductFields product={product} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={product.active} className="size-4 accent-ink" />
            Active (new lots can use this product)
          </label>
          <SubmitButton className={button.primary}>Save</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
