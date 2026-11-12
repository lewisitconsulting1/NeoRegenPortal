import { getStaff } from "@/lib/staff";
import { reportPdf, reportPdfFileName } from "@/server/report-pdf";
import { findReport } from "@/server/reports";

export const dynamic = "force-dynamic";

/** The report as a PDF, for signed-in staff (e.g. to file in the quality system). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getStaff())) return new Response("Sign in required.", { status: 401 });
  const { id } = await params;
  const report = await findReport(id);
  if (!report) return new Response("Not found.", { status: 404 });
  return new Response(Buffer.from(await reportPdf(report)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${reportPdfFileName(report)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
