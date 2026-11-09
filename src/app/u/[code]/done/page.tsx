import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { button } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { loadUnit } from "../load";
import { UnitProblem } from "../problem";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Report received" };

// Anyone holding the card can open this page, so the address is masked.
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(name.length - 1, 6)))}@${domain}`;
}

export default async function DonePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const loaded = await loadUnit(code);
  if (loaded.state === "blocked" || loaded.state === "missing") {
    return (
      <PublicShell>
        <UnitProblem state={loaded.state} />
      </PublicShell>
    );
  }
  const { unit } = loaded;
  if (!unit.report) redirect(`/u/${unit.accessCode}`);

  return (
    <PublicShell>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Report received</h1>
          <p className="mt-2 text-sm text-slate-600">
            Thank you. NeoRegen received the utilization report for unit{" "}
            <span className="font-mono font-semibold text-ink">{unit.unitId}</span> on {formatDate(unit.report.submittedAt)}.
          </p>
          <p className="mt-1 text-sm text-slate-600">A receipt is on its way to {maskEmail(unit.report.submitterEmail)}.</p>
        </div>
        <Link href={`/u/${unit.accessCode}`} className={button.secondary}>
          Back to product
        </Link>
      </div>
    </PublicShell>
  );
}
