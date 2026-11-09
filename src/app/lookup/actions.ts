"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import { normalizeAccessCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { lookupBlocked } from "@/lib/rate-limit";
import { clientInfo } from "@/lib/request";
import { logAccess } from "@/server/customer";

export async function lookupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const client = await clientInfo();
  if (await lookupBlocked(client.ip)) return { error: "Too many attempts from this network. Try again in 15 minutes." };

  const unitId = String(formData.get("unitId") ?? "").trim().toUpperCase();
  const code = normalizeAccessCode(String(formData.get("code") ?? ""));
  const unit = code ? await db.unit.findUnique({ where: { accessCode: code } }) : null;
  // Both must match, so a typo in either is caught rather than opening another unit.
  if (!unit || unit.unitId !== unitId) {
    await logAccess("LOOKUP_FAILED", client);
    return { error: "We couldn't find a unit with that ID and code. Check both and try again." };
  }
  redirect(`/u/${unit.accessCode}`);
}
