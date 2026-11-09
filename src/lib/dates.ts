// Date-only values (expiration, date of use) are stored at UTC midnight and
// always read back in UTC, so they never shift a day with the viewer's zone.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-09" → Date at UTC midnight, or null if it is not a real calendar date. */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " ET";
}

export function todayUtc(): Date {
  return parseDateOnly(new Date().toISOString().slice(0, 10))!;
}
