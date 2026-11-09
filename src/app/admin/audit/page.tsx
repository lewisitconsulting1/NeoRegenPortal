import type { Metadata } from "next";
import Link from "next/link";
import { Empty, link, PageHeader, table } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Audit log" };

const LIMIT = 300;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await requireStaff();
  const { entity } = await searchParams;
  const entries = await db.auditLog.findMany({
    where: entity ? { entityId: entity } : undefined,
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={
          entity ? (
            <>
              One record&apos;s history.{" "}
              <Link href="/admin/audit" className={link}>
                Show everything
              </Link>
            </>
          ) : (
            `Every change staff made, newest first (latest ${LIMIT}).`
          )
        }
      />
      {entries.length === 0 ? (
        <Empty>Nothing recorded yet.</Empty>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className="bg-slate-50">
              <tr>
                <th className={table.th}>When</th>
                <th className={table.th}>Who</th>
                <th className={table.th}>Action</th>
                <th className={table.th}>Record</th>
                <th className={table.th}>Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className={`${table.td} whitespace-nowrap text-slate-600`}>{formatDateTime(e.createdAt)}</td>
                  <td className={table.td}>{e.actorEmail}</td>
                  <td className={`${table.td} font-mono text-xs`}>{e.action}</td>
                  <td className={`${table.td} text-xs`}>
                    <Link href={`/admin/audit?entity=${e.entityId}`} className={link}>
                      {e.entityType}
                    </Link>
                  </td>
                  <td className={`${table.td} text-slate-600`}>{e.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
