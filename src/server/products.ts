import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { fail, isUniqueViolation, type Result } from "@/server/result";

const productSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, "Product code is required.").max(40),
  name: z.string().trim().min(1, "Product name is required.").max(200),
  description: z.string().trim().max(2000).transform((v) => v || null),
  storage: z.string().trim().max(200).transform((v) => v || null),
});

export type ProductInput = z.input<typeof productSchema>;

export async function createProduct(actor: string, input: ProductInput): Promise<Result<{ id: string }>> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  try {
    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({ data: parsed.data });
      await audit(tx, { actor, action: "product.create", entityType: "Product", entityId: created.id, after: created });
      return created;
    });
    return { ok: true, id: product.id };
  } catch (error) {
    if (isUniqueViolation(error)) return fail(`Product code ${parsed.data.code} already exists.`);
    throw error;
  }
}

export async function updateProduct(
  actor: string,
  id: string,
  input: ProductInput & { active: boolean },
): Promise<Result> {
  const parsed = productSchema.extend({ active: z.boolean() }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  try {
    await db.$transaction(async (tx) => {
      const before = await tx.product.findUniqueOrThrow({ where: { id } });
      const after = await tx.product.update({ where: { id }, data: parsed.data });
      await audit(tx, { actor, action: "product.update", entityType: "Product", entityId: id, before, after });
    });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return fail(`Product code ${parsed.data.code} already exists.`);
    throw error;
  }
}
