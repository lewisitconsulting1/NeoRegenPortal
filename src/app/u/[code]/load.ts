import { lookupBlocked } from "@/lib/rate-limit";
import { clientInfo } from "@/lib/request";
import { findUnitByCode, logAccess, type CustomerUnit } from "@/server/customer";

export type LoadedUnit =
  | { state: "blocked" }
  | { state: "missing" }
  | { state: "void"; unit: CustomerUnit }
  | { state: "ok"; unit: CustomerUnit };

/** Every customer page starts here: rate limit, look up, log. */
export async function loadUnit(code: string, { logView = false } = {}): Promise<LoadedUnit> {
  const client = await clientInfo();
  if (await lookupBlocked(client.ip)) return { state: "blocked" };
  const unit = await findUnitByCode(decodeURIComponent(code));
  if (!unit) {
    await logAccess("LOOKUP_FAILED", client);
    return { state: "missing" };
  }
  if (logView) await logAccess("VIEW", client, { unitId: unit.id });
  return unit.voidedAt ? { state: "void", unit } : { state: "ok", unit };
}
