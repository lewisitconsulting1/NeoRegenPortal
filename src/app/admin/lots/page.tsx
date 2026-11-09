import type { Metadata } from "next";
import Link from "next/link";
import { Badge, button, Empty, link, PageHeader, table } from "@/components/ui";
import { formatDate, todayUtc } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { LotStatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Lots" };

export default async function LotsPage() {
  await requireStaff();
  const [lots, reported] = await Promise.all([
    db.lot.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        product: true,
        _count: { select: { units: { where: { voidedAt: null } }, documents: { where: { supersededAt: null } } } },
      },
    }),
    db.unit.groupBy({ by: ["lotId"], where: { report: { isNot: null } }, _count: { _all: true } }),
  ]);
  const reportsByLot = new Map(reported.map((r) => [r.lotId, r._count._all]));
  const today = todayUtc();

  return (
    <>
      <PageHeader
        title="Lots"
        actions={
          <Link href="/admin/lots/new" className={button.primary}>
            New lot
          </Link>
        }
      />
      {lots.length === 0 ? (
        <Empty>No lots yet.</Empty>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className="bg-slate-50">
              <tr>
                <th className={table.th}>Lot</th>
                <th className={table.th}>Product</th>
                <th className={table.th}>Expires</th>
                <th className={table.th}>Status</th>
                <th className={`${table.th} text-right`}>Documents</th>
                <th className={`${table.th} text-right`}>Units</th>
                <th className={`${table.th} text-right`}>Reports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td className={table.td}>
                    <Link href={`/admin/lots/${lot.id}`} className={`${link} font-mono`}>
                      {lot.lotNumber}
                    </Link>
                  </td>
                  <td className={table.td}>{lot.product.name}</td>
                  <td className={`${table.td} whitespace-nowrap`}>
                    {formatDate(lot.expirationDate)} {lot.expirationDate < today ? <Badge tone="red">Expired</Badge> : null}
                  </td>
                  <td className={table.td}>
                    <LotStatusBadge status={lot.status} />
                  </td>
                  <td className={`${table.td} text-right tabular-nums`}>{lot._count.documents}</td>
                  <td className={`${table.td} text-right tabular-nums`}>{lot._count.units}</td>
                  <td className={`${table.td} text-right tabular-nums`}>{reportsByLot.get(lot.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
