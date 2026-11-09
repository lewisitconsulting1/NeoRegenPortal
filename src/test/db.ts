import { db } from "@/lib/db";

/** Empties every table, so each test starts from nothing. */
export async function resetDatabase(): Promise<void> {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  if (list) await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export const pdf = (name = "coa.pdf") => ({
  name,
  type: "application/pdf",
  bytes: Buffer.from(`%PDF-1.4 test ${name} ${Math.random()}`),
});
