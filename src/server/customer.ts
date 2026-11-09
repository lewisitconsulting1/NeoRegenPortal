import type { AccessKind } from "@/generated/prisma/enums";
import { normalizeAccessCode } from "@/lib/codes";
import { db } from "@/lib/db";
import type { ReportInput } from "@/lib/report-form";
import { isUniqueViolation } from "@/server/result";

// What a customer can reach with a unit's access code, and nothing more.

export type Client = { ip: string | null; userAgent: string | null };

export async function logAccess(
  kind: AccessKind,
  client: Client,
  refs: { unitId?: string; documentId?: string } = {},
): Promise<void> {
  await db.accessEvent.create({ data: { kind, ip: client.ip, userAgent: client.userAgent, ...refs } });
}

/** The unit behind a code, with the documents a customer may see. */
export async function findUnitByCode(rawCode: string) {
  const accessCode = normalizeAccessCode(rawCode);
  if (!accessCode) return null;
  const unit = await db.unit.findUnique({
    where: { accessCode },
    include: {
      lot: {
        include: {
          product: true,
          documents: { where: { supersededAt: null }, orderBy: [{ type: "asc" }, { uploadedAt: "asc" }] },
        },
      },
      report: { select: { id: true, submittedAt: true, submitterEmail: true } },
    },
  });
  if (!unit) return null;
  // Draft lots are still being prepared: their documents stay hidden.
  const documents = unit.lot.status === "DRAFT" ? [] : unit.lot.documents;
  return { ...unit, documents };
}

export type CustomerUnit = NonNullable<Awaited<ReturnType<typeof findUnitByCode>>>;

/** A current, visible document of this unit's lot, or null. */
export async function findDownloadableDocument(rawCode: string, documentId: string) {
  const unit = await findUnitByCode(rawCode);
  if (!unit || unit.voidedAt) return null;
  const document = unit.documents.find((d) => d.id === documentId);
  return document ? { unit, document } : null;
}

export type SubmitOutcome =
  | { ok: true; reportId: string }
  | { ok: false; reason: "NOT_FOUND" | "VOID" | "ALREADY_SUBMITTED" };

export async function submitReport(rawCode: string, input: ReportInput, client: Client): Promise<SubmitOutcome> {
  const accessCode = normalizeAccessCode(rawCode);
  const unit = accessCode ? await db.unit.findUnique({ where: { accessCode } }) : null;
  if (!unit) return { ok: false, reason: "NOT_FOUND" };
  if (unit.voidedAt) return { ok: false, reason: "VOID" };

  const { attest: _attest, ...fields } = input;
  try {
    const report = await db.$transaction(async (tx) => {
      const created = await tx.utilizationReport.create({
        data: { ...fields, unitId: unit.id, submitterIp: client.ip, submitterUserAgent: client.userAgent },
      });
      await tx.accessEvent.create({
        data: { kind: "REPORT_SUBMITTED", unitId: unit.id, ip: client.ip, userAgent: client.userAgent },
      });
      return created;
    });
    return { ok: true, reportId: report.id };
  } catch (error) {
    // The unique unitId: someone already reported this unit.
    if (isUniqueViolation(error)) return { ok: false, reason: "ALREADY_SUBMITTED" };
    throw error;
  }
}
