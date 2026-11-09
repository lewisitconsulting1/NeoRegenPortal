"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { lookupBlocked } from "@/lib/rate-limit";
import { parseReport, type ReportErrors } from "@/lib/report-form";
import { clientInfo } from "@/lib/request";
import { submitReport } from "@/server/customer";
import { sendReportEmails } from "@/server/reports";

export type ReportFormState = { errors: ReportErrors } | null;

export async function submitReportAction(
  code: string,
  _previous: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const client = await clientInfo();
  if (await lookupBlocked(client.ip)) {
    return { errors: { form: "Too many attempts from this network. Try again in 15 minutes." } };
  }

  const parsed = parseReport(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const outcome = await submitReport(code, parsed.data, client);
  if (!outcome.ok) {
    // Someone already reported this unit; its page says when.
    if (outcome.reason === "ALREADY_SUBMITTED") redirect(`/u/${code}`);
    return {
      errors: {
        form:
          outcome.reason === "VOID"
            ? "This code is no longer active. Contact NeoRegen before using this product."
            : "We couldn't find this product code.",
      },
    };
  }

  // Emails go out after the response, so a slow mail service never delays
  // the confirmation; the report is already saved either way.
  const reportId = outcome.reportId;
  after(() => sendReportEmails(reportId));
  redirect(`/u/${code}/done`);
}
