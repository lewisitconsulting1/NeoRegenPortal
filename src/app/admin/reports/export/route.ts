import { getStaff } from "@/lib/staff";
import { listReports, reportsCsv } from "@/server/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getStaff())) return new Response("Sign in required.", { status: 401 });
  const params = new URL(request.url).searchParams;
  const show = params.get("show");
  const reports = await listReports({
    q: params.get("q") ?? "",
    show: show === "unreviewed" || show === "adverse" ? show : "all",
  });
  const date = new Date().toISOString().slice(0, 10);
  // The byte-order mark makes Excel read the file as UTF-8.
  return new Response(`﻿${reportsCsv(reports)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="utilization-reports-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
