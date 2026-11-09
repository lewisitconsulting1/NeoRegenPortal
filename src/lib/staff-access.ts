import type { StaffRole } from "@/generated/prisma/enums";
import { config } from "@/lib/config";
import { db } from "@/lib/db";

/**
 * The role an email signs in with, or null if it may not use the admin area:
 * it must be on the staff domain AND either be a bootstrap admin or have an
 * active StaffAccess row.
 */
export async function staffRoleFor(email: string): Promise<StaffRole | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.endsWith(`@${config.staffEmailDomain}`)) return null;
  if (config.bootstrapAdminEmails.includes(normalized)) return "ADMIN";
  const row = await db.staffAccess.findUnique({ where: { email: normalized } });
  return row?.active ? row.role : null;
}
