import Link from "next/link";
import { button, Notice } from "@/components/ui";

/** What a customer sees when a code can't be used. */
export function UnitProblem({ state }: { state: "blocked" | "missing" | "void" }) {
  if (state === "blocked") {
    return (
      <Notice tone="red" title="Too many attempts">
        For security, product lookups from this network are paused. Try again in 15 minutes.
      </Notice>
    );
  }
  if (state === "void") {
    return (
      <Notice tone="red" title="This code is no longer active">
        Don&apos;t use this product until you have spoken with NeoRegen.
      </Notice>
    );
  }
  return (
    <div className="space-y-4">
      <Notice tone="amber" title="We couldn't find that product">
        Check the code printed under the QR on your card. It has 12 letters and numbers.
      </Notice>
      <Link href="/lookup" className={button.secondary}>
        Enter the code by hand
      </Link>
    </div>
  );
}
