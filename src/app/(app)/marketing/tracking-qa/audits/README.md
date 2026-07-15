# Meta Ads tracking-QA — weekly snapshots

Each file here is one week's audit of the **TexasTurf USA** ad account
(`1558027655376028`) and **TexasTurf Pixel** (`1238616098223513`), rendered at
`/marketing/tracking-qa`. The page is presentational — it just reads these
snapshots. No Meta credentials live in the app; data is pulled weekly with the
Facebook Ads tools and written here.

## Add a new week

1. Pull the numbers (last 7 days) for the pixel + `SM-EF_WebsiteLeads_ABO`:
   - **Event volume by type, WEB vs SERVER** — dataset stats (`aggregation=event`,
     `event_source=WEB_ONLY` / `SERVER_ONLY`).
   - **Event Match Quality** — dataset quality: composite score + per-key
     coverage (email, phone, fbc, fbp, external_id). Flag any conversion event
     (esp. Lead) with **no EMQ** or **composite < 6**.
   - **fbc coverage %** — from the quality match keys. Flag if **< ~70%**.
   - **Optimization goal + optimized event vs event firing** — ad-set
     `optimization_goal`; confirm the optimized event is actually firing and is
     usable (has EMQ). Flag mismatches.
   - **Attribution setting + freshness** — ad-set `attribution_setting`,
     dataset `last_fired_time` / upload frequency.
   - **Attribution gap** — pixel Lead count vs Meta-attributed Website Leads
     (campaign `lead`), plus the media buyer's "corrected" count if provided.
2. Copy `2026-07-15.json` to `YYYY-MM-DD.json`, update every field, and
   recompute `flags` against the thresholds above.
3. Wire it into `index.ts` (one import + add to the `SNAPSHOTS` array).
4. Ship (`/ship`). The page auto-selects the newest `weekEnding`.

`attributionGap.buyerCorrectedLeads` stays `null` until the buyer's number is
known; set it when their weekly report lands.
