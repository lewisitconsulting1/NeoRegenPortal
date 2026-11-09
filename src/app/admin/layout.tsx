import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { SignOutButton } from "../login/sign-in";
import { AdminNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="min-h-screen">
      <header className="bg-ink print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/admin" aria-label="Admin dashboard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="NeoRegen Biosciences" width={130} height={27} className="h-7 w-auto" />
          </Link>
          <AdminNav isAdmin={staff.role === "ADMIN"} />
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
            <span>{staff.email}</span>
            <SignOutButton className="rounded-md px-2 py-1 font-medium text-slate-300 hover:bg-white/5 hover:text-white" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
