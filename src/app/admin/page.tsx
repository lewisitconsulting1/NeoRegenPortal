import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Empty, link, PageHeader, table } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { DISPOSITION_LABELS } from "@/lib/labels";
import { requireStaff } from "@/lib/staff";
import { listReports } from "@/server/reports";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard() {
  await requireStaff();
  const [unreviewed, adverse, drafts, awaiting, recent] = await Promise.all([
    db.utilizationReport.count({ where: { reviewedAt: null } }),
    db.utilizationReport.count({ where: { reviewedAt: null, adverseEvent: true } }),
    db.lot.count({ where: { status: "DRAFT" } }),
    db.unit.count({ where: { voidedAt: null, report: null, lot: { status: { not: "DRAFT" } } } }),
    listReports({}, 8),
  ]);

  const tiles = [
    { label: "Adverse events to review", value: adverse, href: "/admin/reports?show=adverse", alert: adverse > 0 },
    { label: "Reports to review", value: unreviewed, href: "/admin/reports?show=unreviewed" },
    { label: "Lots in draft", value: drafts, href: "/admin/lots" },
    { label: "Units with no report yet", value: awaiting, href: "/admin/lots" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="block">
            <Card className={`h-full hover:border-slate-300 ${t.alert ? "border-red-300 bg-red-50" : ""}`}>
              <p className={`text-3xl font-semibold tabular-nums ${t.alert ? "text-red-800" : "text-ink"}`}>{t.value}</p>
              <p className={`mt-1 text-sm ${t.alert ? "text-red-800" : "text-slate-600"}`}>{t.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-ink">Latest reports</h2>
        <Link href="/admin/reports" className={`${link} text-sm`}>
          All reports
        </Link>
      </div>
      {recent.length === 0 ? (
        <Empty>No utilization reports yet.</Empty>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className="bg-slate-50">
              <tr>
                <th className={table.th}>Submitted</th>
                <th className={table.th}>Unit</th>
                <th className={table.th}>Facility</th>
                <th className={table.th}>Disposition</th>
                <th className={table.th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className={`${table.td} whitespace-nowrap text-slate-600`}>{formatDateTime(r.submittedAt)}</td>
                  <td className={table.td}>
                    <Link href={`/admin/reports/${r.id}`} className={`${link} font-mono`}>
                      {r.unit.unitId}
                    </Link>
                  </td>
                  <td className={table.td}>{r.facilityName}</td>
                  <td className={table.td}>{DISPOSITION_LABELS[r.disposition]}</td>
                  <td className={`${table.td} space-x-1`}>
                    {r.adverseEvent ? <Badge tone="red">Adverse event</Badge> : null}
                    {r.reviewedAt ? <Badge tone="green">Reviewed</Badge> : <Badge tone="amber">To review</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
