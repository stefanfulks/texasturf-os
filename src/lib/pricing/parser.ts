/**
 * Natural-language parser for quick job entry.
 * Ported from standalone pricing-tool. Lenient — populates what it detects
 * with high confidence; leaves the rest for manual input.
 */

import type { Application, Access, Edging } from "./calculator";

export type PartialJob = {
  installedSqft?: number;
  product?:       string;
  tearoutTier?:   string;
  application?:   Application;
  access?:        Access;
  edgings?:       Edging[];
  nailerLF?:      number;
  wastePct?:      number;
  targetMargin?:  number;
};

const PRODUCT_KEYWORDS: Array<[string, string]> = [
  ["monte carlo 60", "Monte Carlo 60"],
  ["monte carlo",    "Monte Carlo 60"],
  ["montecarlo",     "Monte Carlo 60"],
  ["majestic 70",    "Majestic 70"],
  ["majestic",       "Majestic 70"],
  ["saratoga 60",    "Saratoga 60"],
  ["sara 60",        "Saratoga 60"],
  ["sara60",         "Saratoga 60"],
  ["saratoga 40",    "Saratoga 40"],
  ["sara 40",        "Saratoga 40"],
  ["sara40",         "Saratoga 40"],
  ["saratoga",       "Saratoga 40"],
  ["royal 40",       "Royal 40"],
  ["royal40",        "Royal 40"],
  ["royal",          "Royal 40"],
  ["kent 44",        "Kent 44"],
  ["kent",           "Kent 44"],
  ["pro putt",       "TexasPutt (pro putt 44)"],
  ["putting green",  "TexasPutt (pro putt 44)"],
  ["putt",           "TexasPutt (pro putt 44)"],
  ["texasmoss",      "TexasMoss"],
  ["moss",           "TexasMoss"],
  ["texaslush",      "TexasLush"],
  ["lush",           "TexasLush"],
  ["texasplay",      "TexasPlay"],
  ["texashaven",     "TexasHaven"],
  ["haven",          "TexasHaven"],
];

export function parseJobDescription(text: string): PartialJob {
  if (!text || typeof text !== "string") return {};

  const t = text.toLowerCase();
  const result: PartialJob = {};

  // Square footage — "1500 sqft" / "1,500 sq ft" / "1500 SF"
  const sqftMatch = t.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet|sf\b)/);
  if (sqftMatch) result.installedSqft = parseInt(sqftMatch[1].replace(/,/g, ""));

  // Product name
  for (const [keyword, productName] of PRODUCT_KEYWORDS) {
    if (t.includes(keyword)) {
      result.product = productName;
      break;
    }
  }

  // Tear-out tier — "tear out 5" / "cat 5" / "tier 5" / "demo level 5"
  const tearoutMatch = t.match(/(?:tear\s*out|demo|tier|category|cat\.?)\s*(?:at\s*|of\s*|level\s*)?(\d{1,2})/);
  if (tearoutMatch) {
    const n = Math.min(10, Math.max(1, parseInt(tearoutMatch[1])));
    result.tearoutTier = String(n);
  }

  // Application
  if (/\b(concrete|slab|on\s*conc|paver\s*deck)\b/.test(t)) {
    result.application = "concrete";
  }

  // Difficult access
  const difficultAccessPattern = /hard\s*access|difficult\s*access|stairs|steep|bucket|hike|tight\s*access|narrow\s*gate|no\s*gate|restricted/;
  if (difficultAccessPattern.test(t)) {
    result.access = "difficult";
  }

  // Edging runs
  const edgingRegex = /(\d+)\s*(?:lf|linear\s*f(?:ee)?t?|feet?)\s*(?:of\s+)?(black|brown|green)?\s*(metal\s*edging|wonder\s*edge|bendaboard|nailer)/gi;
  const edgings: Edging[] = [];
  let m: RegExpExecArray | null;
  while ((m = edgingRegex.exec(text)) !== null) {
    const lf = parseInt(m[1]);
    const color = m[2] ? m[2][0].toUpperCase() + m[2].slice(1).toLowerCase() : "Black";
    const kind = m[3].toLowerCase();
    if (kind.includes("nailer")) {
      result.nailerLF = lf;
    } else if (kind.includes("wonder")) {
      edgings.push({ type: `Wonder Edge ${color}`, lf });
    } else if (kind.includes("bendaboard")) {
      edgings.push({ type: "Bendaboard", lf });
    } else if (kind.includes("metal")) {
      edgings.push({ type: `Metal Edging ${color}`, lf });
    }
  }
  if (edgings.length) result.edgings = edgings;

  // Waste percentage — "15% waste"
  const wasteMatch = t.match(/(\d{1,2})\s*%\s*waste/);
  if (wasteMatch) result.wastePct = parseInt(wasteMatch[1]);

  // Target margin — "50% margin" / "55% gm" / "60% gross margin"
  const marginMatch = t.match(/(\d{2})\s*%\s*(?:margin|gm|gross\s*margin)/);
  if (marginMatch) result.targetMargin = parseInt(marginMatch[1]);

  return result;
}
