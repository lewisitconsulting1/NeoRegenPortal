import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type AuditEntry = {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

// Dates become ISO strings; undefined and null are left out.
function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Call inside the same transaction as the change, so neither lands alone. */
export async function audit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorEmail: entry.actor,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: asJson(entry.before),
      after: asJson(entry.after),
      reason: entry.reason ?? null,
    },
  });
}
