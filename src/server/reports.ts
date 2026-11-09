import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { formatAccessCode } from "@/lib/codes";
import { formatDate, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { DISPOSITION_LABELS } from "@/lib/labels";
import { fail, type Result } from "@/server/result";

export async function markReviewed(actor: string, reportId: string): Promise<Result> {
  return db.$transaction(async (tx) => {
    const report = await tx.utilizationReport.findUniqueOrThrow({ where: { id: reportId } });
    if (report.reviewedAt) return fail("This report was already reviewed.");
    const after = await tx.utilizationReport.update({
      where: { id: reportId },
      data: { reviewedAt: new Date(), reviewedBy: actor },
    });
    await audit(tx, {
      actor,
      action: "report.review",
      entityType: "UtilizationReport",
      entityId: reportId,
      before: { reviewedAt: report.reviewedAt },
      after: { reviewedAt: after.reviewedAt, reviewedBy: actor },
    });
    return { ok: true };
  });
}

// ─── Listing and export ───────────────────────────────────────────────

export type ReportFilter = { q?: string; show?: "all" | "unreviewed" | "adverse" };

export function reportWhere(filter: ReportFilter): Prisma.UtilizationReportWhereInput {
  const where: Prisma.UtilizationReportWhereInput = {};
  if (filter.show === "unreviewed") where.reviewedAt = null;
  if (filter.show === "adverse") where.adverseEvent = true;
  const q = filter.q?.trim();
  if (q) {
    where.OR = [
      { unit: { unitId: { contains: q, mode: "insensitive" } } },
      { facilityName: { contains: q, mode: "insensitive" } },
      { submitterName: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

const withUnit = { unit: { include: { lot: { include: { product: true } } } } } as const;

export type ReportWithUnit = Prisma.UtilizationReportGetPayload<{ include: typeof withUnit }>;

export function listReports(filter: ReportFilter, take?: number): Promise<ReportWithUnit[]> {
  return db.utilizationReport.findMany({
    where: reportWhere(filter),
    include: withUnit,
    orderBy: { submittedAt: "desc" },
    take,
  });
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  // A leading = + - @ would run as a formula in Excel; prefix it with a quote.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function reportsCsv(reports: ReportWithUnit[]): string {
  const header = [
    "Submitted (UTC)", "Unit ID", "Lot", "Product code", "Product", "Facility", "City", "State",
    "Submitted by", "Title", "Email", "Phone", "Physician", "Date of use", "Disposition",
    "Adverse event", "Adverse event details", "Comments", "Reviewed (UTC)", "Reviewed by", "Report ID",
  ];
  const rows = reports.map((r) => [
    r.submittedAt.toISOString(), r.unit.unitId, r.unit.lot.lotNumber, r.unit.lot.product.code,
    r.unit.lot.product.name, r.facilityName, r.facilityCity, r.facilityState, r.submitterName,
    r.submitterTitle, r.submitterEmail, r.submitterPhone, r.physicianName,
    r.dateOfUse.toISOString().slice(0, 10), DISPOSITION_LABELS[r.disposition],
    r.adverseEvent ? "Yes" : "No", r.adverseEventDetails, r.comments,
    r.reviewedAt?.toISOString(), r.reviewedBy, r.id,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ─── Notification emails ──────────────────────────────────────────────

function summary(r: ReportWithUnit): string {
  return [
    `Unit: ${r.unit.unitId}`,
    `Product: ${r.unit.lot.product.name} (${r.unit.lot.product.code})`,
    `Lot: ${r.unit.lot.lotNumber}`,
    `Facility: ${r.facilityName}, ${r.facilityCity}, ${r.facilityState}`,
    `Submitted by: ${r.submitterName}${r.submitterTitle ? `, ${r.submitterTitle}` : ""} <${r.submitterEmail}>`,
    r.physicianName ? `Physician: ${r.physicianName}` : null,
    `Date of use: ${formatDate(r.dateOfUse)}`,
    `Disposition: ${DISPOSITION_LABELS[r.disposition]}`,
    `Adverse event: ${r.adverseEvent ? `YES. ${r.adverseEventDetails ?? ""}` : "No"}`,
    r.comments ? `Comments: ${r.comments}` : null,
    `Submitted: ${formatDateTime(r.submittedAt)}`,
    `Reference: ${r.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** A receipt to the submitter and a notice to QA. Failures are logged, not thrown. */
export async function sendReportEmails(reportId: string): Promise<void> {
  const report = await db.utilizationReport.findUnique({ where: { id: reportId }, include: withUnit });
  if (!report) return;
  const body = summary(report);
  const unitPage = `${config.publicBaseUrl}/u/${formatAccessCode(report.unit.accessCode)}`;
  const adminPage = `${config.publicBaseUrl}/admin/reports/${report.id}`;

  const sends = [
    sendEmail({
      to: [report.submitterEmail],
      subject: `NeoRegen utilization report received: ${report.unit.unitId}`,
      text: `Thank you. NeoRegen received your tissue utilization report.\n\n${body}\n\nUnit page: ${unitPage}\n`,
      replyTo: config.qaEmails[0],
    }),
    sendEmail({
      to: config.qaEmails,
      subject: `${report.adverseEvent ? "[ADVERSE EVENT] " : ""}Utilization report: ${report.unit.unitId}`,
      text: `${report.adverseEvent ? "This report flags an adverse event. Start complaint handling today.\n\n" : ""}${body}\n\nReview: ${adminPage}\n`,
      replyTo: report.submitterEmail,
    }),
  ];
  for (const result of await Promise.allSettled(sends)) {
    if (result.status === "rejected") console.error("Report email failed:", result.reason);
  }
}
