import { audit } from "@/lib/audit";
import { generateAccessCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { fail, isUniqueViolation, type Result } from "@/server/result";

/** Creates the units, each with its own random access code. All or none. */
export async function addUnits(actor: string, lotId: string, unitIds: string[]): Promise<Result<{ count: number }>> {
  if (unitIds.length === 0) return fail("No unit IDs to add.");
  const lot = await db.lot.findUnique({ where: { id: lotId } });
  if (!lot) return fail("Lot not found.");
  if (unitIds.some((id) => !id.startsWith(`${lot.lotNumber}-`))) {
    return fail(`Every unit ID must start with ${lot.lotNumber}-.`);
  }

  const existing = await db.unit.findMany({ where: { unitId: { in: unitIds } }, select: { unitId: true } });
  if (existing.length > 0) {
    const shown = existing.slice(0, 5).map((u) => u.unitId).join(", ");
    return fail(`Already added: ${shown}${existing.length > 5 ? ", …" : ""}`);
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.unit.createMany({
        data: unitIds.map((unitId) => ({ unitId, lotId, accessCode: generateAccessCode(), createdBy: actor })),
      });
      await audit(tx, {
        actor,
        action: "unit.add",
        entityType: "Lot",
        entityId: lotId,
        after: { count: unitIds.length, first: unitIds[0], last: unitIds[unitIds.length - 1] },
      });
    });
  } catch (error) {
    // Another staff member added one of these IDs a moment ago, or (one in
    // 10^18) two codes collided. Nothing was written; trying again is safe.
    if (isUniqueViolation(error)) return fail("Some of these units were just added, or a code clashed. Try again.");
    throw error;
  }
  return { ok: true, count: unitIds.length };
}

export async function voidUnit(actor: string, id: string, reason: string): Promise<Result> {
  const trimmed = reason.trim();
  if (!trimmed) return fail("Give a reason for voiding the unit.");
  return db.$transaction(async (tx) => {
    const unit = await tx.unit.findUniqueOrThrow({ where: { id }, include: { report: { select: { id: true } } } });
    if (unit.voidedAt) return fail("This unit is already void.");
    if (unit.report) return fail("This unit already has a utilization report, so it can't be voided.");
    const after = await tx.unit.update({
      where: { id },
      data: { voidedAt: new Date(), voidReason: trimmed, voidedBy: actor },
    });
    const { report: _report, ...before } = unit;
    await audit(tx, { actor, action: "unit.void", entityType: "Unit", entityId: id, before, after, reason: trimmed });
    return { ok: true };
  });
}

export async function setShippedTo(actor: string, id: string, shippedTo: string): Promise<Result> {
  const value = shippedTo.trim().slice(0, 200) || null;
  await db.$transaction(async (tx) => {
    const before = await tx.unit.findUniqueOrThrow({ where: { id } });
    const after = await tx.unit.update({ where: { id }, data: { shippedTo: value } });
    await audit(tx, { actor, action: "unit.shipped_to", entityType: "Unit", entityId: id, before, after });
  });
  return { ok: true };
}
