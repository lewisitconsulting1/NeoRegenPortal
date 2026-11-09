import { Prisma } from "@/generated/prisma/client";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** True when a write broke a unique constraint (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
