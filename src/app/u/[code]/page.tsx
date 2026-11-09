import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { Badge, button, Card, Empty, Notice } from "@/components/ui";
import { formatAccessCode } from "@/lib/codes";
import { formatDate, todayUtc } from "@/lib/dates";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { loadUnit } from "./load";
import { UnitProblem } from "./problem";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your product" };

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function UnitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const loaded = await loadUnit(code, { logView: true });
  if (loaded.state === "blocked" || loaded.state === "missing") {
    return (
      <PublicShell>
        <UnitProblem state={loaded.state} />
      </PublicShell>
    );
  }

  const { unit } = loaded;
  const { lot } = unit;
  const expired = lot.expirationDate < todayUtc();
  const base = `/u/${unit.accessCode}`;

  return (
    <PublicShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-gold-dark">{lot.product.code}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{lot.product.name}</h1>
        </div>

        {loaded.state === "void" ? <UnitProblem state="void" /> : null}
        {lot.status === "ON_HOLD" && loaded.state === "ok" ? (
          <Notice tone="red" title="This lot is on hold">
            NeoRegen has placed this lot on hold. Don&apos;t use this product until you have spoken with NeoRegen.
          </Notice>
        ) : null}

        <Card>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Unit ID</dt>
              <dd className="mt-0.5 font-mono text-base font-semibold text-ink">{unit.unitId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Lot</dt>
              <dd className="mt-0.5 font-mono text-base font-semibold text-ink">{lot.lotNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Expires</dt>
              <dd className="mt-0.5 flex items-center gap-2 font-medium text-ink">
                {formatDate(lot.expirationDate)}
                {expired ? <Badge tone="red">Expired</Badge> : null}
              </dd>
            </div>
            {lot.product.storage ? (
              <div>
                <dt className="text-slate-500">Storage</dt>
                <dd className="mt-0.5 font-medium text-ink">{lot.product.storage}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        {loaded.state === "ok" ? (
          unit.report ? (
            <Notice tone="green" title="Utilization report received">
              Submitted {formatDate(unit.report.submittedAt)}. Thank you.
            </Notice>
          ) : (
            <Card className="border-gold/60 bg-gold-50">
              <h2 className="text-base font-semibold text-ink">Tissue utilization report</h2>
              <p className="mt-1 text-sm text-slate-700">
                Tell us what happened to this unit: implanted, opened but not used, discarded, or returned. It takes
                about two minutes.
              </p>
              <Link href={`${base}/report`} className={`${button.primary} mt-4 w-full sm:w-auto`}>
                Submit utilization report
              </Link>
            </Card>
          )
        ) : null}

        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Lot documents</h2>
          {lot.status === "DRAFT" ? (
            <Empty>Documents for this lot haven&apos;t been published yet.</Empty>
          ) : unit.documents.length === 0 ? (
            <Empty>No documents are available for this lot.</Empty>
          ) : (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {unit.documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={`${base}/documents/${doc.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
                  >
                    <span>
                      <span className="block font-medium text-ink">{doc.title}</span>
                      <span className="block text-xs text-slate-500">
                        {DOCUMENT_TYPE_LABELS[doc.type]} · version {doc.version} · {fileSize(doc.size)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-gold-dark">Open</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-slate-500">
          Access code <span className="font-mono">{formatAccessCode(unit.accessCode)}</span>
        </p>
      </div>
    </PublicShell>
  );
}
