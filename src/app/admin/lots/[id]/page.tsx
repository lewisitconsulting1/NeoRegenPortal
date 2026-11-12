import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, button, Card, Empty, Field, input, link, Notice, PageHeader, table } from "@/components/ui";
import { DocumentType } from "@/generated/prisma/enums";
import { formatDate, formatDateTime, todayUtc } from "@/lib/dates";
import { db } from "@/lib/db";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { requireStaff } from "@/lib/staff";
import { directUploadsEnabled } from "@/lib/storage";
import { holdLotAction, publishLotAction, releaseHoldAction } from "../../actions";
import { LotStatusBadge } from "../status-badge";
import { AddDocumentForm, ReplaceDocumentForm } from "./document-forms";

export const metadata: Metadata = { title: "Lot" };

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const lot = await db.lot.findUnique({
    where: { id },
    include: { product: true, documents: { orderBy: [{ type: "asc" }, { version: "desc" }] } },
  });
  if (!lot) notFound();

  const [units, reported, voided] = await Promise.all([
    db.unit.count({ where: { lotId: id } }),
    db.unit.count({ where: { lotId: id, report: { isNot: null } } }),
    db.unit.count({ where: { lotId: id, voidedAt: { not: null } } }),
  ]);
  const directUploads = directUploadsEnabled();
  const documentTypes = Object.values(DocumentType).map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] }));
  const current = lot.documents.filter((d) => !d.supersededAt);
  const earlier = lot.documents.filter((d) => d.supersededAt);

  return (
    <>
      <Link href="/admin/lots" className={`${link} text-sm`}>
        ← Lots
      </Link>
      <div className="mt-3">
        <PageHeader
          title={`Lot ${lot.lotNumber}`}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <LotStatusBadge status={lot.status} />
              {lot.product.name} · expires {formatDate(lot.expirationDate)}
              {lot.expirationDate < todayUtc() ? <Badge tone="red">Expired</Badge> : null}
            </span>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-1 text-base font-semibold text-ink">Documents</h2>
            <p className="mb-4 text-sm text-slate-600">
              Customers see the current version of each document once the lot is published. Replaced versions are
              kept here.
            </p>
            {current.length === 0 ? (
              <Empty>No documents yet. Upload at least one before publishing.</Empty>
            ) : (
              <div className={table.wrap}>
                <table className={table.table}>
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={table.th}>Document</th>
                      <th className={table.th}>Uploaded</th>
                      <th className={table.th}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {current.map((doc) => (
                      <tr key={doc.id}>
                        <td className={table.td}>
                          <a href={`/admin/documents/${doc.id}`} className={link}>
                            {doc.title}
                          </a>
                          <p className="text-xs text-slate-500">
                            {DOCUMENT_TYPE_LABELS[doc.type]} · v{doc.version} · {doc.fileName}
                          </p>
                        </td>
                        <td className={`${table.td} text-xs text-slate-600`}>
                          {formatDateTime(doc.uploadedAt)}
                          <br />
                          {doc.uploadedBy}
                        </td>
                        <td className={`${table.td} w-64`}>
                          <details>
                            <summary className="cursor-pointer text-sm font-medium text-gold-dark">Replace</summary>
                            <ReplaceDocumentForm documentId={doc.id} lotId={lot.id} directUploads={directUploads} />
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {earlier.length > 0 ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  Earlier versions ({earlier.length})
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {earlier.map((doc) => (
                    <li key={doc.id}>
                      <a href={`/admin/documents/${doc.id}`} className={link}>
                        {doc.title} v{doc.version}
                      </a>{" "}
                      <span className="text-xs text-slate-500">
                        replaced {formatDateTime(doc.supersededAt!)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold text-ink">Upload a document</h2>
            <AddDocumentForm lotId={lot.id} directUploads={directUploads} types={documentTypes} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-base font-semibold text-ink">Status</h2>
            {lot.status === "DRAFT" ? (
              <ActionForm
                action={publishLotAction.bind(null, lot.id)}
                confirm={`Publish lot ${lot.lotNumber}? Customers who scan its units will see its documents.`}
                className="space-y-3"
              >
                <p className="text-sm text-slate-600">Customers can&apos;t see this lot&apos;s documents yet.</p>
                <SubmitButton className={`${button.primary} w-full`} pendingText="Publishing…">
                  Publish lot
                </SubmitButton>
              </ActionForm>
            ) : null}
            {lot.status === "PUBLISHED" ? (
              <ActionForm action={holdLotAction.bind(null, lot.id)} className="space-y-3">
                <p className="text-sm text-slate-600">
                  Published {lot.publishedAt ? formatDateTime(lot.publishedAt) : ""} by {lot.publishedBy}.
                </p>
                <Field label="Reason for a hold" name="reason" hint="Customers see only that the lot is on hold, not the reason.">
                  <input id="reason" name="reason" required className={input} />
                </Field>
                <SubmitButton className={`${button.danger} w-full`} pendingText="Saving…">
                  Put lot on hold
                </SubmitButton>
              </ActionForm>
            ) : null}
            {lot.status === "ON_HOLD" ? (
              <div className="space-y-3">
                <Notice tone="red" title="On hold">
                  {lot.holdReason}
                </Notice>
                <ActionForm action={releaseHoldAction.bind(null, lot.id)} className="space-y-3">
                  <Field label="Reason for releasing" name="reason">
                    <input id="reason" name="reason" required className={input} />
                  </Field>
                  <SubmitButton className={`${button.secondary} w-full`}>Release hold</SubmitButton>
                </ActionForm>
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-ink">Units</h2>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs text-slate-500">Units</dt>
                <dd className="text-xl font-semibold tabular-nums">{units - voided}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Reported</dt>
                <dd className="text-xl font-semibold tabular-nums">{reported}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Void</dt>
                <dd className="text-xl font-semibold tabular-nums">{voided}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <Link href={`/admin/lots/${lot.id}/units`} className={button.secondary}>
                Manage units
              </Link>
              {units - voided > 0 ? (
                <Link href={`/admin/lots/${lot.id}/cards`} className={button.secondary}>
                  Print QR cards
                </Link>
              ) : null}
            </div>
          </Card>

          <p className="text-xs text-slate-500">
            Created {formatDateTime(lot.createdAt)} by {lot.createdBy}.{" "}
            <Link href={`/admin/audit?entity=${lot.id}`} className={link}>
              History
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
