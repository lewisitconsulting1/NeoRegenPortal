import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, button, Card, Empty, Field, input, link, PageHeader, table } from "@/components/ui";
import { formatAccessCode } from "@/lib/codes";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { MAX_UNITS_PER_ADD } from "@/lib/units";
import { addUnitListAction, addUnitRangeAction, setShippedToAction, voidUnitAction } from "../../../actions";

export const metadata: Metadata = { title: "Units" };

export default async function UnitsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const lot = await db.lot.findUnique({
    where: { id },
    include: {
      product: true,
      units: { orderBy: { unitId: "asc" }, include: { report: { select: { id: true, submittedAt: true } } } },
    },
  });
  if (!lot) notFound();
  const active = lot.units.filter((u) => !u.voidedAt);
  const unreported = active.filter((u) => !u.report);

  return (
    <>
      <Link href={`/admin/lots/${lot.id}`} className={`${link} text-sm`}>
        ← Lot {lot.lotNumber}
      </Link>
      <div className="mt-3">
        <PageHeader
          title={`Units in lot ${lot.lotNumber}`}
          subtitle={`${lot.product.name} · ${active.length} active, ${active.length - unreported.length} reported`}
          actions={
            active.length > 0 ? (
              <>
                <Link href={`/admin/lots/${lot.id}/cards`} className={button.secondary}>
                  Print all QR cards
                </Link>
                {unreported.length > 0 && unreported.length < active.length ? (
                  <Link href={`/admin/lots/${lot.id}/cards?only=unreported`} className={button.secondary}>
                    Print cards without a report
                  </Link>
                ) : null}
              </>
            ) : null
          }
        />
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-base font-semibold text-ink">Add a range</h2>
          <p className="mb-4 text-sm text-slate-600">
            Unit numbers as on the vial labels, e.g. 1 to 40 adds {lot.lotNumber}-0001 to {lot.lotNumber}-0040.
          </p>
          <ActionForm action={addUnitRangeAction.bind(null, lot.id)} resetOnSuccess className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="From" name="from" required>
                <input id="from" name="from" type="number" min={1} max={9999} required className={input} />
              </Field>
              <Field label="To" name="to" required>
                <input id="to" name="to" type="number" min={1} max={9999} required className={input} />
              </Field>
            </div>
            <SubmitButton className={button.primary} pendingText="Adding…">
              Add units
            </SubmitButton>
          </ActionForm>
        </Card>
        <Card>
          <h2 className="mb-1 text-base font-semibold text-ink">Paste unit IDs</h2>
          <p className="mb-4 text-sm text-slate-600">One per line, for units that aren&apos;t a continuous range. Up to {MAX_UNITS_PER_ADD} at a time.</p>
          <ActionForm action={addUnitListAction.bind(null, lot.id)} resetOnSuccess className="space-y-4">
            <Field label="Unit IDs" name="unitIds" required>
              <textarea id="unitIds" name="unitIds" rows={3} required className={`${input} font-mono`} placeholder={`${lot.lotNumber}-0001\n${lot.lotNumber}-0002`} />
            </Field>
            <SubmitButton className={button.primary} pendingText="Adding…">
              Add units
            </SubmitButton>
          </ActionForm>
        </Card>
      </div>

      {lot.units.length === 0 ? (
        <Empty>No units yet.</Empty>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className="bg-slate-50">
              <tr>
                <th className={table.th}>Unit</th>
                <th className={table.th}>Access code</th>
                <th className={table.th}>Shipped to</th>
                <th className={table.th}>Report</th>
                <th className={table.th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lot.units.map((unit) => (
                <tr key={unit.id} className={unit.voidedAt ? "bg-slate-50 text-slate-500" : undefined}>
                  <td className={`${table.td} font-mono font-medium`}>{unit.unitId}</td>
                  <td className={`${table.td} font-mono text-xs`}>{formatAccessCode(unit.accessCode)}</td>
                  <td className={table.td}>
                    {unit.voidedAt ? (
                      unit.shippedTo ?? "—"
                    ) : (
                      <ActionForm action={setShippedToAction.bind(null, unit.id, unit.lotId)} className="flex gap-2">
                        <input
                          name="shippedTo"
                          defaultValue={unit.shippedTo ?? ""}
                          placeholder="Facility"
                          aria-label={`Shipped to, ${unit.unitId}`}
                          className={`${input} py-1.5 sm:text-xs`}
                        />
                        <SubmitButton className={`${button.secondary} px-3 py-1.5 text-xs`} pendingText="…">
                          Save
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                  <td className={table.td}>
                    {unit.report ? (
                      <Link href={`/admin/reports/${unit.report.id}`} className={link}>
                        {formatDate(unit.report.submittedAt)}
                      </Link>
                    ) : unit.voidedAt ? (
                      <Badge>Void</Badge>
                    ) : (
                      <span className="text-slate-400">None yet</span>
                    )}
                  </td>
                  <td className={`${table.td} w-56`}>
                    {unit.voidedAt ? (
                      <span className="text-xs">Void: {unit.voidReason}</span>
                    ) : unit.report ? null : (
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-red-700">Void unit</summary>
                        <ActionForm
                          action={voidUnitAction.bind(null, unit.id, unit.lotId)}
                          confirm={`Void ${unit.unitId}? Its QR code will stop working.`}
                          className="mt-2 space-y-2"
                        >
                          <input name="reason" required placeholder="Reason" aria-label="Reason" className={`${input} py-1.5 sm:text-xs`} />
                          <SubmitButton className={`${button.danger} px-3 py-1.5 text-xs`} pendingText="…">
                            Void
                          </SubmitButton>
                        </ActionForm>
                      </details>
                    )}
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
