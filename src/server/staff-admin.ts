import { z } from "zod";
import { StaffRole } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { fail, type Result } from "@/server/result";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))
  .refine((email) => email.endsWith(`@${config.staffEmailDomain}`), {
    message: `Only @${config.staffEmailDomain} accounts can be staff.`,
  });

/** Adds a staff member, or reactivates one and sets their role. */
export async function grantAccess(actor: string, input: { email: string; role: string }): Promise<Result> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) return fail(email.error.issues[0].message);
  const role = z.enum(StaffRole).safeParse(input.role);
  if (!role.success) return fail("Choose a role.");

  await db.$transaction(async (tx) => {
    const before = await tx.staffAccess.findUnique({ where: { email: email.data } });
    const after = await tx.staffAccess.upsert({
      where: { email: email.data },
      create: { email: email.data, role: role.data, addedBy: actor },
      update: { role: role.data, active: true },
    });
    await audit(tx, { actor, action: "staff.grant", entityType: "StaffAccess", entityId: email.data, before, after });
  });
  return { ok: true };
}

export async function revokeAccess(actor: string, email: string): Promise<Result> {
  const normalized = email.trim().toLowerCase();
  if (normalized === actor) return fail("You can't remove your own access.");
  return db.$transaction(async (tx) => {
    const before = await tx.staffAccess.findUnique({ where: { email: normalized } });
    if (!before?.active) return fail("That person doesn't have access.");
    const after = await tx.staffAccess.update({ where: { email: normalized }, data: { active: false } });
    await audit(tx, { actor, action: "staff.revoke", entityType: "StaffAccess", entityId: normalized, before, after });
    // End their sessions now rather than at expiry.
    await tx.session.deleteMany({ where: { user: { email: normalized } } });
    return { ok: true };
  });
}
