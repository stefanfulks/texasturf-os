import { describe, it, expect } from "vitest"
import { slugifyTag, colorForSlug } from "@/lib/tags/normalize"
import { TAG_COLORS } from "@/lib/tags/colors"

describe("slugifyTag", () => {
  it("lowercases and hyphenates whitespace", () => {
    expect(slugifyTag("  Hot  Lead ")).toBe("hot-lead")
  })
  it("strips punctuation so VIP variants collapse", () => {
    expect(slugifyTag("VIP")).toBe("vip")
    expect(slugifyTag("vip")).toBe("vip")
    expect(slugifyTag("V.I.P.")).toBe("vip")
  })
  it("collapses repeated separators and trims hyphens", () => {
    expect(slugifyTag("--Spanish / English--")).toBe("spanish-english")
  })
  it("returns empty string for punctuation-only input", () => {
    expect(slugifyTag("!!!")).toBe("")
  })
})

describe("colorForSlug", () => {
  it("returns a palette color", () => {
    expect(TAG_COLORS).toContain(colorForSlug("hot-lead"))
  })
  it("is deterministic for the same slug", () => {
    expect(colorForSlug("referral")).toBe(colorForSlug("referral"))
  })
})
