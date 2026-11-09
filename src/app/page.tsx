import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { button, link } from "@/components/ui";

export default function Home() {
  return (
    <PublicShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">NeoRegen product portal</h1>
        <p className="text-slate-700">
          Scan the QR code on the card that came with your NeoRegen product to open its lot documents and submit the
          tissue utilization report.
        </p>
        <Link href="/lookup" className={button.primary}>
          Enter a code by hand
        </Link>
        <p className="pt-6 text-xs text-slate-500">
          NeoRegen staff:{" "}
          <Link href="/login" className={link}>
            sign in
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
