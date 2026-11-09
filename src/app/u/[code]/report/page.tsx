import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { link, Notice } from "@/components/ui";
import { toDateInput, todayUtc } from "@/lib/dates";
import { loadUnit } from "../load";
import { UnitProblem } from "../problem";
import { submitReportAction } from "./actions";
import { ReportForm } from "./report-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Utilization report" };

export default async function ReportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const loaded = await loadUnit(code);
  if (loaded.state !== "ok") {
    return (
      <PublicShell>
        <UnitProblem state={loaded.state} />
      </PublicShell>
    );
  }

  const { unit } = loaded;
  if (unit.report) redirect(`/u/${unit.accessCode}`);

  return (
    <PublicShell>
      <div className="space-y-6">
        <div>
          <Link href={`/u/${unit.accessCode}`} className={`${link} text-sm`}>
            ← Back to product
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Tissue utilization report</h1>
          <p className="mt-1 text-sm text-slate-600">
            {unit.lot.product.name} · unit <span className="font-mono font-semibold text-ink">{unit.unitId}</span>
          </p>
        </div>
        {unit.lot.status === "ON_HOLD" ? (
          <Notice tone="red" title="This lot is on hold">
            You can still report what happened to this unit. NeoRegen will be in touch.
          </Notice>
        ) : null}
        <ReportForm action={submitReportAction.bind(null, unit.accessCode)} today={toDateInput(todayUtc())} />
      </div>
    </PublicShell>
  );
}
