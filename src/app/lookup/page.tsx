import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PublicShell } from "@/components/public-shell";
import { button, Field, input } from "@/components/ui";
import { lookupAction } from "./actions";

export const metadata: Metadata = { title: "Find your product" };

export default function LookupPage() {
  return (
    <PublicShell>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Find your product</h1>
      <p className="mt-1 text-sm text-slate-600">
        If the QR code won&apos;t scan, enter the unit ID and the code printed on the card.
      </p>
      <ActionForm action={lookupAction} className="mt-6 space-y-4">
        <Field label="Unit ID" name="unitId" required hint="For example NB260001-0001">
          <input id="unitId" name="unitId" required className={`${input} font-mono uppercase`} autoComplete="off" autoCapitalize="characters" />
        </Field>
        <Field label="Code" name="code" required hint="12 letters and numbers, for example K7QF-3MZP-9TXA">
          <input id="code" name="code" required className={`${input} font-mono uppercase`} autoComplete="off" autoCapitalize="characters" />
        </Field>
        <SubmitButton className={`${button.primary} w-full sm:w-auto`} pendingText="Looking up…">
          Find product
        </SubmitButton>
      </ActionForm>
    </PublicShell>
  );
}
