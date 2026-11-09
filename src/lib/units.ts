// Unit IDs follow the tissue tracker's format, LOT-NNNN (NB260001-0001), so the
// QR card and the vial label agree. The portal never derives anything else
// from them: the access code is separate and random.

export const MAX_UNITS_PER_ADD = 500;

const LOT_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,30}$/;

export function normalizeLotNumber(input: string): string | null {
  const value = input.trim().toUpperCase();
  return LOT_PATTERN.test(value) ? value : null;
}

export function formatUnitId(lotNumber: string, n: number): string {
  return `${lotNumber}-${String(n).padStart(4, "0")}`;
}

export type UnitIdsResult = { ok: true; unitIds: string[] } | { ok: false; error: string };

export function unitIdsFromRange(lotNumber: string, from: number, to: number): UnitIdsResult {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 9999 || from > to) {
    return { ok: false, error: "Enter whole unit numbers from 1 to 9999, with the first no higher than the last." };
  }
  if (to - from + 1 > MAX_UNITS_PER_ADD) {
    return { ok: false, error: `Add at most ${MAX_UNITS_PER_ADD} units at a time.` };
  }
  const unitIds: string[] = [];
  for (let n = from; n <= to; n++) unitIds.push(formatUnitId(lotNumber, n));
  return { ok: true, unitIds };
}

/** Unit IDs pasted one per line (or separated by commas or spaces). */
export function unitIdsFromList(lotNumber: string, text: string): UnitIdsResult {
  const entries = text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (entries.length === 0) return { ok: false, error: "Paste at least one unit ID." };
  if (entries.length > MAX_UNITS_PER_ADD) {
    return { ok: false, error: `Add at most ${MAX_UNITS_PER_ADD} units at a time.` };
  }

  const prefix = `${lotNumber}-`;
  const bad = entries.filter((id) => {
    const rest = id.slice(prefix.length);
    return !id.startsWith(prefix) || !/^\d{1,4}$/.test(rest) || Number(rest) < 1;
  });
  if (bad.length > 0) {
    const shown = bad.slice(0, 5).join(", ") + (bad.length > 5 ? ", …" : "");
    return { ok: false, error: `Not a unit of lot ${lotNumber} (expected ${formatUnitId(lotNumber, 1)}): ${shown}` };
  }

  const unitIds = entries.map((id) => formatUnitId(lotNumber, Number(id.slice(prefix.length))));
  const repeated = unitIds.filter((id, i) => unitIds.indexOf(id) !== i);
  if (repeated.length > 0) {
    return { ok: false, error: `Listed more than once: ${[...new Set(repeated)].slice(0, 5).join(", ")}` };
  }
  return { ok: true, unitIds };
}
