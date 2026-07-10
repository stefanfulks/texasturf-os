import { Tags } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  updateWebAvailability,
  type WebAvailabilityTier,
} from "@/lib/turfcasa/web-availability";

/**
 * TurfCasa storefront catalog — availability control.
 *
 * One row per storefront product; the office sets the availability tier +
 * whether it shows online. What's set here is exactly what turfcasa.com
 * displays (same-day pickup vs. 1–2 days vs. weeks/months), auto-promoted to
 * "same-day" by the DB view when real rolls are on hand. Retail pricing for the
 * house line stays on the Catalog pricing side (turfcasa_products).
 */

export const dynamic = "force-dynamic";

type Row = {
  web_slug: string;
  manufacturer: "shaw" | "turfcasa";
  availability: WebAvailabilityTier;
  lead_time_days: number | null;
  web_visible: boolean;
};

const TIER_LABEL: Record<WebAvailabilityTier, string> = {
  same_day: "In stock · same-day pickup",
  lead_1_2_days: "Ships in 1–2 days",
  lead_weeks: "2–4 weeks",
  lead_months: "1–3 months",
  unavailable: "Unavailable",
};

const TIERS = Object.keys(TIER_LABEL) as WebAvailabilityTier[];

function titleize(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function TurfcasaCatalogPage() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("turfcasa_web_availability")
    .select("web_slug, manufacturer, availability, lead_time_days, web_visible")
    .order("manufacturer", { ascending: true })
    .order("web_slug", { ascending: true });

  const rows = (data ?? []) as Row[];
  const groups: { key: "turfcasa" | "shaw"; label: string; items: Row[] }[] = [
    { key: "turfcasa", label: "TurfCasa house line + supplies", items: rows.filter((r) => r.manufacturer === "turfcasa") },
    { key: "shaw", label: "Shawgrass", items: rows.filter((r) => r.manufacturer === "shaw") },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">TurfCasa</p>
        <h1 className="page-title">Catalog · Online availability</h1>
        <p className="mt-1 text-sm text-ink-2">
          Set what turfcasa.com shows for each product. &ldquo;Same-day pickup&rdquo; is applied
          automatically when rolls are on hand; the rest are lead-time estimates you control.
          Untick <em>Show online</em> to pull a product from the storefront.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-warn"><Tags className="h-5 w-5" /></span>
            <p className="empty-state-title">No storefront products yet</p>
            <p className="empty-state-body">
              Apply the <code>turfcasa_web_catalog</code> migration to seed one row per storefront
              product, then adjust availability here.
            </p>
          </div>
        </div>
      ) : (
        groups.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.key} className="panel">
              <h2 className="text-sm font-semibold text-ink mb-3">
                {group.label}{" "}
                <span className="text-ink-2 font-normal">({group.items.length})</span>
              </h2>
              <div className="space-y-2">
                {group.items.map((row) => (
                  <form
                    key={row.web_slug}
                    action={updateWebAvailability}
                    className="flex flex-wrap items-center gap-2 border-t border-hairline pt-2 first:border-t-0 first:pt-0"
                  >
                    <input type="hidden" name="web_slug" value={row.web_slug} />
                    <span className="min-w-[11rem] flex-1 text-sm text-ink">
                      {titleize(row.web_slug)}
                    </span>
                    <select
                      name="availability"
                      defaultValue={row.availability}
                      className="rounded-md border border-hairline bg-surface px-2 py-1 text-sm text-ink"
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          {TIER_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      name="lead_time_days"
                      defaultValue={row.lead_time_days ?? ""}
                      placeholder="days"
                      min={0}
                      className="w-20 rounded-md border border-hairline bg-surface px-2 py-1 text-sm text-ink"
                      aria-label="Lead time in days (optional)"
                    />
                    <label className="inline-flex items-center gap-1.5 text-sm text-ink-2">
                      <input type="checkbox" name="web_visible" defaultChecked={row.web_visible} />
                      Show online
                    </label>
                    <button
                      type="submit"
                      className="rounded-full bg-warn px-3 py-1 text-sm font-medium text-white hover:opacity-90"
                    >
                      Save
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}
