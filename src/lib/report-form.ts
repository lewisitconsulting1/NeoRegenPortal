import { z } from "zod";
import { Disposition } from "@/generated/prisma/enums";
import { parseDateOnly, todayUtc } from "@/lib/dates";

// The utilization report form, validated on the server. Fields follow the
// design doc's draft; match them to the paper form before go-live.

export const REPORT_FIELDS = [
  "facilityName",
  "facilityCity",
  "facilityState",
  "submitterName",
  "submitterTitle",
  "submitterEmail",
  "submitterPhone",
  "physicianName",
  "dateOfUse",
  "disposition",
  "adverseEvent",
  "adverseEventDetails",
  "comments",
  "attest",
] as const;

export type ReportField = (typeof REPORT_FIELDS)[number];
export type ReportValues = Record<ReportField, string>;
export type ReportErrors = Partial<Record<ReportField | "form", string>>;

const required = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);
const optional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, "This is too long.")
    .transform((v) => (v === "" ? null : v));

const schema = z.object({
  facilityName: required("Facility name"),
  facilityCity: required("City", 100),
  facilityState: required("State", 50),
  submitterName: required("Your name", 120),
  submitterTitle: optional(120),
  submitterEmail: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  submitterPhone: optional(40),
  physicianName: optional(120),
  dateOfUse: z.string().transform((value, ctx) => {
    const date = parseDateOnly(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Enter the date of use." });
      return z.NEVER;
    }
    return date;
  }),
  disposition: z.enum(Disposition, { error: "Choose what happened to the tissue." }),
  adverseEvent: z
    .enum(["yes", "no"], { error: "Answer the adverse event question." })
    .transform((v) => v === "yes"),
  adverseEventDetails: optional(2000),
  comments: optional(2000),
  attest: z.literal("on", { error: "Confirm the information is accurate." }),
});

export type ReportInput = z.output<typeof schema>;

export function reportValues(formData: FormData): ReportValues {
  const values = {} as ReportValues;
  for (const field of REPORT_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === "string" ? raw : "";
  }
  return values;
}

// Checks that depend on two fields run on the raw values, so their messages
// show alongside every other error rather than only after the rest pass.
function crossFieldErrors(values: ReportValues): ReportErrors {
  const errors: ReportErrors = {};
  if (values.adverseEvent === "yes" && values.adverseEventDetails.trim() === "") {
    errors.adverseEventDetails = "Describe the adverse event.";
  }
  if (values.disposition === "IMPLANTED" && values.physicianName.trim() === "") {
    errors.physicianName = "Enter the physician when the tissue was implanted or applied.";
  }
  const date = parseDateOnly(values.dateOfUse);
  if (date) {
    // One day of slack so a report filed late in the evening in Hawaii
    // is not refused for a date that is already "tomorrow" in UTC.
    const latest = todayUtc().getTime() + 24 * 60 * 60 * 1000;
    if (date.getTime() > latest) errors.dateOfUse = "The date of use can't be in the future.";
    if (date.getUTCFullYear() < 2020) errors.dateOfUse = "Check the year of the date of use.";
  }
  return errors;
}

export type ParsedReport =
  | { ok: true; data: ReportInput; values: ReportValues }
  | { ok: false; errors: ReportErrors; values: ReportValues };

export function parseReport(formData: FormData): ParsedReport {
  const values = reportValues(formData);
  const errors: ReportErrors = {};
  const result = schema.safeParse(values);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form") as ReportField;
      errors[key] ??= issue.message;
    }
  }
  for (const [key, message] of Object.entries(crossFieldErrors(values))) {
    errors[key as ReportField] ??= message;
  }
  if (!result.success || Object.keys(errors).length > 0) return { ok: false, errors, values };
  // Details typed before the answer was switched to "no" aren't kept.
  const data = result.data.adverseEvent ? result.data : { ...result.data, adverseEventDetails: null };
  return { ok: true, data, values };
}
