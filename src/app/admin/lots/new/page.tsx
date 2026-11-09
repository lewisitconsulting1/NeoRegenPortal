import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { button, Card, Field, input, link, Notice, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { createLotAction } from "../../actions";

export const metadata: Metadata = { title: "New lot" };

export default async function NewLotPage() {
  await requireStaff();
  const products = await db.product.findMany({ where: { active: true }, orderBy: { code: "asc" } });

  return (
    <>
      <Link href="/admin/lots" className={`${link} text-sm`}>
        ← Lots
      </Link>
      <div className="mt-3">
        <PageHeader title="New lot" subtitle="Lots start as drafts. Customers see nothing until you publish." />
      </div>
      {products.length === 0 ? (
        <Notice title="Add a product first">
          Every lot belongs to a product.{" "}
          <Link href="/admin/products" className={link}>
            Add one
          </Link>
          .
        </Notice>
      ) : (
        <Card className="max-w-xl">
          <ActionForm action={createLotAction} className="space-y-4">
            <Field label="Lot number" name="lotNumber" required hint="As printed on the label, e.g. NB260001">
              <input id="lotNumber" name="lotNumber" required className={`${input} font-mono uppercase`} />
            </Field>
            <Field label="Product" name="productId" required>
              <select id="productId" name="productId" required className={input} defaultValue="">
                <option value="" disabled>
                  Choose a product
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expiration date" name="expirationDate" required>
              <input id="expirationDate" name="expirationDate" type="date" required className={`${input} sm:max-w-48`} />
            </Field>
            <SubmitButton className={button.primary} pendingText="Creating…">
              Create lot
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
