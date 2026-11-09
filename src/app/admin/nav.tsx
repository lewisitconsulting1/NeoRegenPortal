"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/lots", label: "Lots" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/products", label: "Products" },
    ...(isAdmin ? [{ href: "/admin/users", label: "Users" }] : []),
    { href: "/admin/audit", label: "Audit log" },
  ];
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-white/10 text-gold" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
