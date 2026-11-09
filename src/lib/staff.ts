import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { StaffRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { staffRoleFor } from "@/lib/staff-access";

export type Staff = { email: string; name: string; role: StaffRole };

const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** The signed-in staff member, or null. Checks access on every request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const session = await getSession();
  if (!session) return null;
  const role = await staffRoleFor(session.user.email);
  if (!role) return null;
  return { email: session.user.email.toLowerCase(), name: session.user.name, role };
});

/** Every admin page and server action starts here; hiding a button protects nothing. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (staff) return staff;
  redirect((await getSession()) ? "/unauthorized" : "/login");
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "ADMIN") redirect("/unauthorized");
  return staff;
}
