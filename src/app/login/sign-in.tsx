"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { button, Field, input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function GoogleSignIn() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={`${button.primary} w-full`}
      onClick={async () => {
        setBusy(true);
        await authClient.signIn.social({ provider: "google", callbackURL: "/admin", errorCallbackURL: "/login" });
      }}
    >
      {busy ? "Opening Google…" : "Sign in with Google"}
    </button>
  );
}

/** Email and password, for local development only (ALLOW_DEV_LOGIN=1). */
export function DevSignIn() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    setError(null);
    let { error } = await authClient.signIn.email({ email, password });
    if (error?.status === 401) ({ error } = await authClient.signUp.email({ email, password, name: email.split("@")[0] }));
    setBusy(false);
    if (error) setError(error.message ?? "Sign-in failed.");
    else router.push("/admin");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Email" name="email">
        <input id="email" name="email" type="email" required className={input} />
      </Field>
      <Field label="Password" name="password" hint="At least 8 characters. First use creates the account.">
        <input id="password" name="password" type="password" required minLength={8} className={input} />
      </Field>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={busy} className={`${button.secondary} w-full`}>
        {busy ? "Signing in…" : "Dev sign-in"}
      </button>
    </form>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
