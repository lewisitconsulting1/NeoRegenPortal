import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { button } from "@/components/ui";

export default function NotFound() {
  return (
    <PublicShell>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">Check the address, or scan the QR code on your product card again.</p>
      <Link href="/" className={`${button.secondary} mt-6`}>
        Go to the portal home
      </Link>
    </PublicShell>
  );
}
