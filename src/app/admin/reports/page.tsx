import type { Metadata } from "next";
import Link from "next/link";
import { Badge, button, Empty, input, link, PageHeader, table } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/dates";
import { DISPOSITION_LABELS } from "@/lib/labels";
import { requireStaff } from "@/lib/staff";
import { listReports, type ReportFilter } from "@/server/reports";

export const metadata: Metadata = { title: "Reports" };

const LIMIT = 200;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  await requireStaff();
  const params = await searchParams;
  const filter: ReportFilter = {
    q: params.q ?? "",
    show: params.show === "unreviewed" || params.show === "adverse" ? params.show : "all",
  };
  const reports = await listReports(filter, LIMIT + 1);
  const query = new URLSearchParams({ q: filter.q ?? "", show: filter.show ?? "all" }).toString();

  return (
    <>
      <PageHeader
        title="Utilization reports"
        actions={
          <a href={`/admin/reports/export?${query}`} className={button.secondary}>
            Export CSV
          </a>
        }
      />
      <form className="mb-6 flex flex-col gap-3 sm:flex-row" role="search">
        <input
          name="q"
          defaultValue={filter.q}
          placeholder="Search unit ID, facility or submitter"
          aria-label="Search"
          className={`${input} sm:max-w-sm`}
        />
        <select name="show" defaultValue={filter.show} aria-label="Show" className={`${input} sm:w-56`}>
          <option value="all">All reports</option>
          <option value="unreviewed">Not yet reviewed</option>
          <option value="adverse">Adverse events</option>
        </select>
        <button type="submit" className={button.secondary}>
          Filter
        </button>
      </form>

      {reports.length === 0 ? (
        <Empty>No reports match.</Empty>
      ) : (
        <>
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={table.th}>Submitted</th>
                  <th className={table.th}>Unit</th>
                  <th className={table.th}>Facility</th>
                  <th className={table.th}>Used</th>
                  <th className={table.th}>Disposition</th>
                  <th className={table.th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.slice(0, LIMIT).map((r) => (
                  <tr key={r.id}>
                    <td className={`${table.td} whitespace-nowrap text-slate-600`}>{formatDateTime(r.submittedAt)}</td>
                    <td className={table.td}>
                      <Link href={`/admin/reports/${r.id}`} className={`${link} font-mono`}>
                        {r.unit.unitId}
                      </Link>
                    </td>
                    <td className={table.td}>
                      {r.facilityName}
                      <p className="text-xs text-slate-500">
                        {r.facilityCity}, {r.facilityState}
                      </p>
                    </td>
                    <td className={`${table.td} whitespace-nowrap`}>{formatDate(r.dateOfUse)}</td>
                    <td className={table.td}>{DISPOSITION_LABELS[r.disposition]}</td>
                    <td className={`${table.td} space-x-1 whitespace-nowrap`}>
                      {r.adverseEvent ? <Badge tone="red">Adverse event</Badge> : null}
                      {r.reviewedAt ? <Badge tone="green">Reviewed</Badge> : <Badge tone="amber">To review</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reports.length > LIMIT ? (
            <p className="mt-3 text-sm text-slate-600">
              Showing the latest {LIMIT}. Narrow the search, or export CSV for all of them.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
