import { describe, it, expect } from "vitest";
import { monthsFromFiscalStart, weekStartsForTimeline } from "@/lib/finance/periods";

describe("periods", () => {
  it("monthsFromFiscalStart returns 12 months labelled from the fiscal start", () => {
    const m = monthsFromFiscalStart("2026-01-01");
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ month: 1, label: "Jan 2026" });
    expect(m[11]).toEqual({ month: 12, label: "Dec 2026" });
  });
  it("monthsFromFiscalStart wraps across the year for a non-Jan start", () => {
    const m = monthsFromFiscalStart("2026-07-01");
    expect(m[0]).toEqual({ month: 7, label: "Jul 2026" });
    expect(m[11]).toEqual({ month: 6, label: "Jun 2027" });
  });
  it("weekStartsForTimeline returns 13 Mondays: 4 history + current + 8 forecast", () => {
    const w = weekStartsForTimeline("2026-06-15");
    expect(w).toHaveLength(13);
    expect(w[4]).toBe("2026-06-15");
    expect(w[0]).toBe("2026-05-18");
    expect(w[12]).toBe("2026-08-10"); // current + 8 forecast weeks = +56 days
  });
});
