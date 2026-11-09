import { db } from "@/lib/db";

// A code holds 60 random bits, so guessing one is hopeless anyway; this
// keeps someone from hammering the lookup and filling the access log.
export const LOOKUP_WINDOW_MS = 15 * 60 * 1000;
export const LOOKUP_LIMIT = 20;

/** True once an IP has had LOOKUP_LIMIT failed lookups inside the window. */
export async function lookupBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const failures = await db.accessEvent.count({
    where: {
      ip,
      kind: "LOOKUP_FAILED",
      createdAt: { gte: new Date(Date.now() - LOOKUP_WINDOW_MS) },
    },
  });
  return failures >= LOOKUP_LIMIT;
}
