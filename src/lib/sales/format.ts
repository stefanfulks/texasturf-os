// Compact money for the pipeline UI. $880 / $88K / $1.2M — tight enough for a
// deal card, precise enough for a header. Evergreen's format.ts isn't ported;
// this is the one local helper the sales module needs.

/** Compact USD: $0 / $880 / $88K / $1.2M. Null/0 → "$0". */
export function usd(value: number | null | undefined): string {
  const n = value ?? 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${Math.round(abs / 1_000)}K`;
  }
  return `${sign}$${Math.round(abs)}`;
}

/** Full USD with grouping: $88,400. For tables/stat cards where precision reads better. */
export function usdFull(value: number | null | undefined): string {
  const n = value ?? 0;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Short date: "Jun 15". Empty string for null. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
