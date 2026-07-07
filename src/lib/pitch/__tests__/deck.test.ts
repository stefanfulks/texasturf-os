import { describe, it, expect } from "vitest";
import { DEFAULT_DECK, type SlideKind } from "../deck";

// Mirrors the full SlideKind union in ../deck.ts — update BOTH when adding a
// kind (this list went stale twice: media + ratings shipped without it).
const KNOWN: SlideKind[] = [
  "cover", "why_turf", "savings", "why_us", "gallery", "media", "video",
  "process", "reviews", "ratings", "pricing", "financing", "close",
];

describe("DEFAULT_DECK", () => {
  it("is non-empty", () => {
    expect(DEFAULT_DECK.length).toBeGreaterThan(0);
  });
  it("only uses known slide kinds", () => {
    for (const s of DEFAULT_DECK) expect(KNOWN).toContain(s.kind);
  });
  it("has exactly one pricing slide", () => {
    expect(DEFAULT_DECK.filter((s) => s.kind === "pricing").length).toBe(1);
  });
  it("opens on a cover and ends on a close", () => {
    expect(DEFAULT_DECK[0].kind).toBe("cover");
    expect(DEFAULT_DECK[DEFAULT_DECK.length - 1].kind).toBe("close");
  });
});
