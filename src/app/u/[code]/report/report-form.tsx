"use client";

import { startTransition, useActionState, useState } from "react";
import { button, Field, input } from "@/components/ui";
import type { ReportField } from "@/lib/report-form";
import type { ReportFormState } from "./actions";

const DISPOSITIONS = [
  { value: "IMPLANTED", label: "Implanted or applied" },
  { value: "OPENED_NOT_USED", label: "Opened but not used" },
  { value: "DISCARDED", label: "Discarded (damaged or expired)" },
  { value: "RETURNED", label: "Returned to NeoRegen" },
];

type Action = (state: ReportFormState, formData: FormData) => Promise<ReportFormState>;

export function ReportForm({ action, today }: { action: Action; today: string }) {
  const [state, dispatch, pending] = useActionState(action, null);
  const [disposition, setDisposition] = useState("");
  const [adverse, setAdverse] = useState("");
  const errors = state?.errors ?? {};
  const errorCount = Object.keys(errors).filter((k) => k !== "form").length;

  // Typed values stay put when the server sends errors back.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  const describe = (name: ReportField) =>
    errors[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {};

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {errors.form || errorCount > 0 ? (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {errors.form ?? `Please fix ${errorCount === 1 ? "the field" : `the ${errorCount} fields`} marked below.`}
        </div>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="mb-1 text-base font-semibold text-ink">Facility</legend>
        <Field label="Facility name" name="facilityName" required error={errors.facilityName}>
          <input id="facilityName" name="facilityName" className={input} autoComplete="organization" {...describe("facilityName")} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="City" name="facilityCity" required error={errors.facilityCity}>
            <input id="facilityCity" name="facilityCity" className={input} autoComplete="address-level2" {...describe("facilityCity")} />
          </Field>
          <Field label="State" name="facilityState" required error={errors.facilityState}>
            <input id="facilityState" name="facilityState" className={input} autoComplete="address-level1" {...describe("facilityState")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-base font-semibold text-ink">Use of the tissue</legend>
        <Field label="Date of use" name="dateOfUse" required error={errors.dateOfUse}>
          <input id="dateOfUse" name="dateOfUse" type="date" max={today} className={`${input} sm:max-w-48`} {...describe("dateOfUse")} />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-800">
            What happened to this unit?<span className="text-red-700"> *</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What happened to this unit?">
            {DISPOSITIONS.map((d) => (
              <label
                key={d.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm has-checked:border-ink has-checked:ring-2 has-checked:ring-ink/15"
              >
                <input
                  type="radio"
                  name="disposition"
                  value={d.value}
                  checked={disposition === d.value}
                  onChange={() => setDisposition(d.value)}
                  className="size-4 accent-ink"
                />
                {d.label}
              </label>
            ))}
          </div>
          {errors.disposition ? <p id="disposition-error" className="mt-1 text-sm text-red-700">{errors.disposition}</p> : null}
        </div>

        <Field
          label="Physician"
          name="physicianName"
          required={disposition === "IMPLANTED"}
          hint={disposition === "IMPLANTED" ? undefined : "Required when the tissue was implanted or applied."}
          error={errors.physicianName}
        >
          <input id="physicianName" name="physicianName" className={input} {...describe("physicianName")} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-base font-semibold text-ink">Adverse event</legend>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-800">
            Was there an adverse event or reaction?<span className="text-red-700"> *</span>
          </p>
          <div className="flex gap-2" role="radiogroup" aria-label="Was there an adverse event or reaction?">
            {[
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ].map((o) => (
              <label
                key={o.value}
                className="flex min-w-24 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm has-checked:border-ink has-checked:ring-2 has-checked:ring-ink/15"
              >
                <input
                  type="radio"
                  name="adverseEvent"
                  value={o.value}
                  checked={adverse === o.value}
                  onChange={() => setAdverse(o.value)}
                  className="size-4 accent-ink"
                />
                {o.label}
              </label>
            ))}
          </div>
          {errors.adverseEvent ? <p id="adverseEvent-error" className="mt-1 text-sm text-red-700">{errors.adverseEvent}</p> : null}
        </div>
        <div hidden={adverse !== "yes"}>
          <Field label="Describe the adverse event" name="adverseEventDetails" required error={errors.adverseEventDetails}>
            <textarea id="adverseEventDetails" name="adverseEventDetails" rows={4} className={input} {...describe("adverseEventDetails")} />
          </Field>
          <p className="mt-2 text-xs text-slate-600">NeoRegen&apos;s quality team is notified as soon as you submit.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-base font-semibold text-ink">Your details</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your name" name="submitterName" required error={errors.submitterName}>
            <input id="submitterName" name="submitterName" className={input} autoComplete="name" {...describe("submitterName")} />
          </Field>
          <Field label="Title or role" name="submitterTitle" error={errors.submitterTitle}>
            <input id="submitterTitle" name="submitterTitle" className={input} autoComplete="organization-title" />
          </Field>
          <Field label="Email" name="submitterEmail" required hint="We'll send your receipt here." error={errors.submitterEmail}>
            <input id="submitterEmail" name="submitterEmail" type="email" className={input} autoComplete="email" {...describe("submitterEmail")} />
          </Field>
          <Field label="Phone" name="submitterPhone" error={errors.submitterPhone}>
            <input id="submitterPhone" name="submitterPhone" type="tel" className={input} autoComplete="tel" />
          </Field>
        </div>
        <Field label="Comments" name="comments" error={errors.comments}>
          <textarea id="comments" name="comments" rows={3} className={input} />
        </Field>
      </fieldset>

      <div className="space-y-4 border-t border-slate-200 pt-6">
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input type="checkbox" name="attest" className="mt-0.5 size-4 accent-ink" {...describe("attest")} />
          <span>I confirm this report is accurate to the best of my knowledge.</span>
        </label>
        {errors.attest ? <p id="attest-error" className="text-sm text-red-700">{errors.attest}</p> : null}
        <p className="text-xs text-slate-500">Do not enter patient names or other patient identifiers.</p>
        <button type="submit" disabled={pending} className={`${button.primary} w-full sm:w-auto`}>
          {pending ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </form>
  );
}
