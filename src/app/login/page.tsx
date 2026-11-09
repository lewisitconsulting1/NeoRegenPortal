import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { Card, Notice } from "@/components/ui";
import { config } from "@/lib/config";
import { getStaff } from "@/lib/staff";
import { DevSignIn, GoogleSignIn } from "./sign-in";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getStaff()) redirect("/admin");
  const { error } = await searchParams;
  const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <PublicShell>
      <div className="mx-auto max-w-sm space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Staff sign in</h1>
        {error ? (
          <Notice tone="red" title="You couldn't be signed in">
            Use your @{config.staffEmailDomain} Google account. If you still can&apos;t get in, ask an admin to add you.
          </Notice>
        ) : null}
        <Card className="space-y-4">
          {googleReady ? (
            <GoogleSignIn />
          ) : (
            <p className="text-sm text-slate-600">Google sign-in isn&apos;t configured yet (GOOGLE_CLIENT_ID).</p>
          )}
          {config.devLoginEnabled ? (
            <div className="border-t border-slate-200 pt-4">
              <DevSignIn />
            </div>
          ) : null}
        </Card>
      </div>
    </PublicShell>
  );
}
