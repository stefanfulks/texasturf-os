// Date helpers for sales risk/rollup math. Day math is done at UTC-noon to
// dodge DST edges; "today" is TexasTurf-local (Central), matching the
// convention the Turfy assistant already uses.

const DAY_MS = 86_400_000;

function atNoon(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime();
}

/** Whole days from a → b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((atNoon(b) - atNoon(a)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date(atNoon(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** '2026-06' bucket for monthly rollups. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Today in Central time as YYYY-MM-DD. */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
}
