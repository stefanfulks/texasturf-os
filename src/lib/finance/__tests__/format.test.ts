import { describe, it, expect } from "vitest";
import { usd, pct, signedUsd } from "@/lib/finance/format";

// Generic figures (repo is public — no real business numbers in tests).
describe("format", () => {
  it("usd formats whole dollars with thousands separators", () => {
    expect(usd(1234567)).toBe("$1,234,567");
    expect(usd(0)).toBe("$0");
  });
  it("pct formats a decimal fraction as a percent", () => {
    expect(pct(0.4)).toBe("40.0%");
  });
  it("signedUsd shows a leading sign", () => {
    expect(signedUsd(-5000)).toBe("-$5,000");
    expect(signedUsd(5000)).toBe("+$5,000");
  });
});
