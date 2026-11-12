import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, button, Card, link, Notice, PageHeader } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { DISPOSITION_LABELS } from "@/lib/labels";
import { requireStaff } from "@/lib/staff";
import { markReviewedAction } from "../../actions";

export const metadata: Metadata = { title: "Report" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm whitespace-pre-wrap text-ink">{children}</dd>
    </div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const report = await db.utilizationReport.findUnique({
    where: { id },
    include: { unit: { include: { lot: { include: { product: true } } } } },
  });
  if (!report) notFound();
  const { unit } = report;

  return (
    <>
      <Link href="/admin/reports" className={`${link} text-sm`}>
        ← Reports
      </Link>
      <div className="mt-3">
        <PageHeader
          title={`Report for ${unit.unitId}`}
          subtitle={`Submitted ${formatDateTime(report.submittedAt)}`}
          actions={
            <>
              <a href={`/admin/reports/${report.id}/pdf`} className={button.secondary}>
                Download PDF
              </a>
              {report.reviewedAt ? (
                <Badge tone="green">
                  Reviewed {formatDateTime(report.reviewedAt)} by {report.reviewedBy}
                </Badge>
              ) : (
                <ActionForm action={markReviewedAction.bind(null, report.id)} className="flex items-center gap-3">
                  <SubmitButton className={button.primary}>Mark reviewed</SubmitButton>
                </ActionForm>
              )}
            </>
          }
        />
      </div>

      {report.adverseEvent ? (
        <div className="mb-6">
          <Notice tone="red" title="Adverse event reported">
            {report.adverseEventDetails}
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <dl className="divide-y divide-slate-100">
            <Row label="Facility">
              {report.facilityName}
              {"\n"}
              {report.facilityCity}, {report.facilityState}
            </Row>
            <Row label="Date of use">{formatDate(report.dateOfUse)}</Row>
            <Row label="Disposition">{DISPOSITION_LABELS[report.disposition]}</Row>
            <Row label="Physician">{report.physicianName ?? "—"}</Row>
            <Row label="Adverse event">{report.adverseEvent ? "Yes" : "No"}</Row>
            <Row label="Submitted by">
              {report.submitterName}
              {report.submitterTitle ? `, ${report.submitterTitle}` : ""}
              {"\n"}
              <a href={`mailto:${report.submitterEmail}`} className={link}>
                {report.submitterEmail}
              </a>
              {report.submitterPhone ? `\n${report.submitterPhone}` : ""}
            </Row>
            <Row label="Comments">{report.comments ?? "—"}</Row>
            <Row label="Sent from">{report.submitterIp ?? "unknown"}</Row>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-semibold text-ink">Unit</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Unit ID</dt>
              <dd className="font-mono font-medium">{unit.unitId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Lot</dt>
              <dd>
                <Link href={`/admin/lots/${unit.lotId}`} className={`${link} font-mono`}>
                  {unit.lot.lotNumber}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Product</dt>
              <dd>{unit.lot.product.name}</dd>
            </div>
            {unit.shippedTo ? (
              <div>
                <dt className="text-slate-500">Shipped to</dt>
                <dd>{unit.shippedTo}</dd>
              </div>
            ) : null}
          </dl>
          <a href={`/u/${unit.accessCode}`} className={`${link} mt-4 inline-block text-sm`}>
            Open customer page
          </a>
        </Card>
      </div>
    </>
  );
}
