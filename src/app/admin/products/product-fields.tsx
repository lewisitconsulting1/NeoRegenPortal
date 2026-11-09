import { Field, input } from "@/components/ui";

export function ProductFields({
  product,
}: {
  product?: { code: string; name: string; description: string | null; storage: string | null };
}) {
  return (
    <>
      <Field label="Product code" name="code" required hint="As on the label, e.g. NEO-AM-2X3">
        <input id="code" name="code" required defaultValue={product?.code} className={`${input} font-mono uppercase`} />
      </Field>
      <Field label="Name" name="name" required>
        <input id="name" name="name" required defaultValue={product?.name} className={input} />
      </Field>
      <Field label="Storage" name="storage" hint="Shown to customers, e.g. Room temperature, 15–30 °C">
        <input id="storage" name="storage" defaultValue={product?.storage ?? ""} className={input} />
      </Field>
      <Field label="Description" name="description">
        <textarea id="description" name="description" rows={3} defaultValue={product?.description ?? ""} className={input} />
      </Field>
    </>
  );
}
