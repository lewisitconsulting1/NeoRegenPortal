import Link from "next/link";

/** Header and footer for the pages customers see. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const support = process.env.SUPPORT_EMAIL;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-ink">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label="NeoRegen product portal home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="NeoRegen Biosciences" width={160} height={34} className="h-8 w-auto" />
          </Link>
          <span className="text-xs font-medium tracking-wide text-gold uppercase">Product portal</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-5 text-xs text-slate-500">
          Questions about a NeoRegen product?{" "}
          {support ? (
            <a className="font-medium text-gold-dark hover:underline" href={`mailto:${support}`}>
              {support}
            </a>
          ) : (
            "Contact NeoRegen."
          )}
        </div>
      </footer>
    </div>
  );
}
