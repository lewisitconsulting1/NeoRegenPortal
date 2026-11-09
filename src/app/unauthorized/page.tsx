import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { button, Notice } from "@/components/ui";
import { SignOutButton } from "../login/sign-in";

export const metadata: Metadata = { title: "No access" };

export default function UnauthorizedPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-sm space-y-5">
        <Notice tone="amber" title="You don't have access to this page">
          Your account isn&apos;t on the staff list, or this page is for admins only. Ask an admin if you need access.
        </Notice>
        <SignOutButton className={button.secondary} />
      </div>
    </PublicShell>
  );
}
