import { randomInt } from "node:crypto";

// Crockford base32: no I, L, O or U, so a code copied by hand has no
// look-alike characters. 12 characters carry 60 random bits, far beyond
// what anyone could guess, unlike sequential unit IDs.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 12;

export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/**
 * Accepts what a person might type: lower case, dashes, spaces, and the
 * letters Crockford reads as digits (O as 0, I and L as 1). Returns null when
 * the result cannot be a code.
 */
export function normalizeAccessCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

/** K7QF3MZP9TXA → K7QF-3MZP-9TXA, for reading and typing. */
export function formatAccessCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}
