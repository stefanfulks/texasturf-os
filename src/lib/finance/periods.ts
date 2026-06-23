const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function monthsFromFiscalStart(startISO: string): { month: number; label: string }[] {
  const start = new Date(startISO + "T00:00:00Z");
  const startMonth0 = start.getUTCMonth();          // 0-11
  const startYear = start.getUTCFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const m0 = (startMonth0 + i) % 12;
    const year = startYear + Math.floor((startMonth0 + i) / 12);
    return { month: m0 + 1, label: `${MONTHS[m0]} ${year}` };
  });
}

export function weekStartsForTimeline(currentMondayISO: string, history = 4, forecast = 8): string[] {
  const cur = new Date(currentMondayISO + "T00:00:00Z");
  const out: string[] = [];
  for (let i = -history; i <= forecast; i++) {
    const d = new Date(cur);
    d.setUTCDate(d.getUTCDate() + i * 7);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
