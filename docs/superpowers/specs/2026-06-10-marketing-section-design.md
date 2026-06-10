# Marketing Section — Design Spec

**Date:** 2026-06-10
**Status:** Approved design (Stefan + team brainstorm session)
**Scope:** TexasTurf marketing program (referral campaign, multi-service campaigns, content engine) + the `/marketing` section of texasturf-os that operationalizes it.

---

## 1. Context and goals

TexasTurf wants to dramatically increase lead volume through three motions:

1. **Referral call campaign** — call every past client (via Reevo's Power Dialer) and ask for referrals, rewarding closed referrals with a $250 Visa gift card or 1 free year of the TexasTurf Care Plan.
2. **Multi-service marketing** — market all 13 service lines, not just artificial turf: xeriscape, lot clearing, pavers, artificial turf, tree removal, excavation, stone work, site prep, concrete, court installations (pickleball/basketball), fencing, welding, landscape design.
3. **Content engine** — Troy's educational YouTube channel, Max's Meta-glasses POV content, and per-job field content from every crew, with a centralized library and real accountability inside the app.

Email/marketing sends execute in **Jobber**; outbound calls/sequences execute in **Reevo** (replacing GoHighLevel/AGM, decision 2026-06-10); **the app is the system of record** — campaign briefs, the referral ledger, the content pipeline, and the accountability scoreboard live here.

### Decisions locked during brainstorm (2026-06-10)

| Decision | Choice |
|---|---|
| Build order | Referral campaign hub ships first, end-to-end |
| Reward #2 ("basic insurance") | TexasTurf's **own care/maintenance plan**, branded "TexasTurf Care Plan." The word "insurance" never appears in written materials |
| Reward trigger | Referred job **completed + final invoice paid** |
| Architecture | Lean: new tables + existing rails (tasks, KPIs, jobber_clients, storage patterns) |
| Tool split | Reevo = calls/sequences · Jobber = client-facing sends + passive referral links · App = ledger, briefs, content accountability |

---

## 2. Tool architecture

| Layer | Tool | Responsibilities |
|---|---|---|
| Outbound execution | **Reevo** (reevo.ai) | Power Dialer call sessions from sequences (auto-advance, dispositions, recordings, AI summaries), follow-up text/email steps, future email journeys. Replaces GHL/AGM |
| Client-facing sends | **Jobber** | Campaign emails to client segments (Campaigns add-on), automated post-job referral asks with tracked links (Referrals add-on), review requests (Reviews add-on). Marketing Suite bundle ≈ $79/mo — buy decision is an open item |
| System of record | **texasturf-os** | Referral roster + outcomes + reward ledger, campaign briefs/copy/results, content pipeline + library index, Troy/Max accountability (recurring tasks + KPIs), marketing dashboard |
| Master file storage | **Google Drive** | All raw + final video/photo files |
| Distribution | **YouTube** (+ IG/TikTok/FB) | Publishing channels only — never the archive |

**Data flow (referral campaign):** app builds roster from synced `jobber_clients` → CSV export → Reevo list + call sequence → team dials → caller logs outcome in app → referrals tracked stage-by-stage → reward marked due on completed+paid → fulfillment logged.

**Explicitly not built:** in-app email/SMS sending (Jobber/Reevo own sends), video storage in Supabase (egress at $0.09/GB makes it the wrong tool; metadata only), Reevo API integration in v1 (CSV handoff until the API is verified), campaign automation engine (Reevo owns sequences).

---

## 3. Referral program — "The Thank-You Blitz"

### 3.1 Offer

- **Referrer reward (their choice):** $250 Visa gift card **or** 1 year TexasTurf Care Plan free.
- **Referred friend:** $100 off their project (double-sided offers out-convert one-sided; gives clients a gift to give, not a favor to ask).
- **Earned when:** the referred project is completed and the final invoice is paid.
- **No cap:** unlimited referrals per client, one reward per closed referral. Offer never expires.
- **Eligibility:** referred person must be a different household/company than the referrer; any new signed project counts (including a past client being referred for a new project).

### 3.2 The TexasTurf Care Plan (new product, funded by this campaign)

Included (1-year term): one annual deep-clean & power-groom visit · seam/edge inspection with minor repairs included · drainage check · pet-odor treatment · priority scheduling · 10% off any other TexasTurf service line.

- Delivery cost ≈ half a crew-day ($150–250) — cheaper than the gift card.
- Renewal price proposal: **$299/yr** (confirm before month-11 renewal outreach).
- Every "free year" creates a renewal conversation and seeds a recurring-revenue line (maintenance was last offered ~2019 per the service catalog).
- Compliance wording: always "Care Plan," never "insurance" or "warranty extension."

### 3.3 Call campaign mechanics

**Roster (built in app):** all `jobber_clients` with ≥1 completed job and a valid phone. Priority order: installs completed in last 12 months → high-value jobs → everyone else. **B2B partners are excluded** from the dialer roster and routed to the partner track (§3.6).

**Reevo sequence (built manually in Reevo, documented here):**
1. Call task (Power Dialer) — dispositions: Interested/Referred → end; Call Back Later → pause; No Answer/Voicemail → continue
2. Wait 1 hour → follow-up text (template §3.5)
3. Wait 5 days → second call attempt
4. End. Two attempts max — this is a thank-you program, not a collections call.

**Cadence & ownership (proposal — confirm owners):** 25 calls/day per caller in a 60–90 min Reevo session. Callers: Colin (residential re-engagement is already his lane), Troy and/or office as second seat. A 2-seat effort covers ~250 clients in 4–6 weeks.

**Outcome logging (in app, ≤10 seconds per call):** No answer · Declined · **Referred** (+ name, phone, service interest) · Do-not-call · Invalid number. Do-not-call is permanent and excluded from all future rosters.

### 3.4 Call script (residential)

**Opener:** "Hey [first name]! This is [caller] with TexasTurf — we did your [backyard/turf] over on [street] back in [season]. How's it holding up?"

*Pause and genuinely listen. If they report a problem: capture it, promise follow-up, and do NOT pitch — the call just became a service-recovery call (which protects the relationship and often still earns the referral later).*

**Transition:** "Love to hear it. So the reason I'm calling — we're growing this year mostly through our past clients instead of spending it all on ads. We'd rather pay you than Facebook."

**The ask:** "If you know anyone — a neighbor, friend, somebody from work — who's been talking about turf, a patio, a pickleball court, really any outdoor project: when they complete a project with us, you get a **$250 Visa gift card**, or if you'd rather, a **full year of our Care Plan free** — annual deep clean, inspection, minor repairs covered. Who comes to mind?"

*Stop talking. Let them think — don't fill the silence.*

**If they give a name:** "Awesome. Want to text them first, or are you good with me reaching out and mentioning you sent us? Either way they get $100 off their project — so you're doing them a favor." → capture name, phone, likely service. → "You're set. The second their project wraps and pays out, your reward's on the way. And the offer never expires — anyone you think of later, just text this number."

**Objection handling:**
- *"Can't think of anyone right now."* → "Totally normal — I'll text you the details right after this call so it's in your pocket. If anyone ever mentions their yard, you've got $250 sitting in that text."
- *"What's the Care Plan?"* → "Once a year we come out, deep-clean and re-groom the turf, check seams and edges, fix small stuff free, and you get priority scheduling plus 10% off anything else we do."
- *"How do I actually get the $250?"* → "Visa gift card, mailed or hand-delivered the week your friend's final invoice is paid. No hoops, no points, no app."
- *"Do they really get a discount?"* → "$100 off, yes. We skip the ad spend and split it with people instead."

**Voicemail (≤20 seconds):** "Hey [name], it's [caller] from TexasTurf — we did your yard on [street]. Nothing's wrong! We just launched a thank-you program for past clients: refer anyone with an outdoor project and you get $250 or a free year of turf care when their project completes. I'll text you the details — thanks!"

### 3.5 Supporting copy (sent via Jobber / Reevo)

**Follow-up text:** "Hi [name], it's [caller] from TexasTurf 👋 Quick recap: know anyone wanting turf, pavers, a sport court, fencing — any outdoor project? When they complete a project with us you get a **$250 Visa gift card** (or a free year of our Care Plan), and they get **$100 off**. Just reply with a name & number anytime — this never expires. 🙏"

**Announcement email (Jobber Campaigns, goes out the week calling starts):**
- Subject A: "We'd rather pay you than Facebook"
- Subject B: "Your friends + our crew = $250 for you"
- Body (short): We're growing through the people who already trust us — our past clients. Refer a friend with any outdoor project (turf, pavers, courts, fencing, concrete, full landscapes). When their project completes: you get $250 or a free year of the TexasTurf Care Plan, they get $100 off. Reply to this email or text [number] with a name. — Stefan & the TexasTurf crew
- CTA button: "Refer a friend"

**Reward-sent thank-you (Jobber):** "Your $250 is on its way — thank you for trusting us with your people. That means everything to a crew like ours."

### 3.6 B2B partner track (separate — no gift cards)

Pool builders, designers, GCs, landscape companies (Cody Pools, Denali, Your Haven, etc.) don't get a $250 card — it cheapens the relationship and may violate their employers' policies. Instead: reciprocal referrals, priority scheduling, and a standing per-project arrangement discussed face-to-face. Owner: Allison (it's her lane). The app tracks these as referrals with `segment = b2b_partner` but no reward record.

### 3.7 Targets and math

- 100% of eligible past clients called within 6 weeks of launch
- ≥15 referred quotes and ≥5 closed referred jobs within 90 days
- At ~$10k average install, $250 ≈ 2.5% acquisition cost (vs paid-lead CPL); plug real average job value when confirmed
- Funnel tracked on dashboard: calls made → referrals captured → quoted → signed → completed+paid → rewards sent

---

## 4. Multi-service campaign — "We Build Complete Outdoor Spaces"

**Positioning:** TexasTurf is not a turf company — it's an outdoor construction company. One crew relationship, thirteen capabilities.

### 4.1 Service spotlight system

One service line per month. Each spotlight ships the same kit:
1 Jobber email to the matching client segment · 1 Troy long video · 4–6 short cuts (editor) · 1 before/after photo set · 1 SEO blog post (joins the existing cluster strategy) · yard-sign/social CTA swap.

### 4.2 12-month spotlight calendar

| Month | Spotlight | Angle |
|---|---|---|
| Jul 2026 | Pickleball & sport courts | "Beat the waitlist for fall leagues" |
| Aug 2026 | Xeriscape | Water restrictions — "your lawn is dying anyway" |
| Sep 2026 | Fencing + custom welding | Security, gates, steel that lasts |
| Oct 2026 | Pavers & stone work | Patio season; holiday-hosting runway |
| Nov 2026 | Concrete | Driveways, patios, slabs before year-end |
| Dec 2026 | Tree removal & lot clearing | Dormant season = right time + availability |
| Jan 2027 | Excavation & site prep | B2B-heavy: builders planning spring starts |
| Feb 2027 | Landscape design | "Design now, build in spring" |
| Mar 2027 | Full-yard transformations | Design→build showcase stories |
| Apr 2027 | Putting greens | Masters season |
| May 2027 | Turf for dogs | Highest-converting niche |
| Jun 2027 | Turf vs Texas heat | Myth-busting, 105°F tests |

### 4.3 Cross-sell engine

Past turf clients are the warmest list for courts, pavers, and fencing — they already trust the crew. Every spotlight email goes to past clients first (Jobber segment), cold audiences second. B2B variant: builders/pool companies already buying turf get the bundled-trades pitch — site prep, concrete, fencing, welding — "one sub instead of five."

---

## 5. Content engine

### 5.1 Programs

| Program | Owner | Cadence | Notes |
|---|---|---|---|
| Educational authority (YouTube long-form) | **Troy** | 1 video/week, publishes Friday | Topics follow §5.2; talking-head + job-site B-roll; each long video → 3–5 shorts via editor |
| POV / day-in-the-life | **Max** (Meta glasses) | 2–3 clips/week | Excavator cab, loading, seam work, timelapses — the raw views engine |
| Field proof | **Every crew** | Per job: 1 before walkthrough, 1 process clip, 1 after reveal | Foreman checklist item; files land in the Drive intake folder; office/Troy triage weekly |
| Editor handoff | Editor (per 2026 plan retainer) | 25–35 cuts/month | Pulls from Drive intake; brand: dark green, Barlow Condensed |

### 5.2 Troy — 12-week starter calendar

| Wk | Title | Tie-in |
|---|---|---|
| 1 | How Much Does Artificial Turf Cost in Texas? (honest 2026 breakdown) | SEO pillar 1 |
| 2 | Best Artificial Turf for Dogs — what we actually install | SEO pillar 2 |
| 3 | Does Turf Melt in Texas Heat? We test it at 105°F | SEO pillar 3 |
| 4 | Pickleball Court Cost: the full budget breakdown | Jul spotlight |
| 5 | Xeriscape 101 for Central Texas — kill your water bill | Aug spotlight |
| 6 | Pavers vs Stamped Concrete — an honest comparison | Oct spotlight |
| 7 | What "Site Prep" Actually Means (and why cheap quotes skip it) | Trust builder |
| 8 | Lot Clearing: what it costs and what to expect | Service intro |
| 9 | 5 Mistakes People Make Buying Turf (from hundreds of installs) | Evergreen |
| 10 | Putting Green Install — start to finish | Service intro |
| 11 | Fence Options Compared: wood vs steel vs custom welded | Sep spotlight |
| 12 | Designing a Full Backyard — a real project, sketch to done | Design showcase |

**Troy's weekly cycle (recurring tasks in app):** Mon — pick topic + outline/script · Wed — film (piggyback on an active job site) · Thu — hand to editor · Fri — publish + log in library. KPI scoreboard tracks published count, views, and leads attributed ("how did you hear about us?" → video).

### 5.3 Repurposing flow

YouTube long-form is the hub → editor cuts shorts → YouTube Shorts, Instagram Reels, TikTok, Facebook (matches the 2026 plan's channel list). Every piece logged once in the app library with links to where it published.

### 5.4 Content idea bank (seeded into the app, status = "idea")

**Troy / educational (beyond the 12 weeks):** drainage explained · pet odor: what actually works · infill myths (we install zero-infill) · HOA approval guide by city · DIY vs pro install — where DIY goes wrong · turf brands compared honestly · financing options explained · warranty walkthrough · winter turf care · how to clean turf after a dog · "watch us quote a yard live" · reading a turf sample like a pro · why Netherlands-sourced matters · grading & drainage 101 · "what we found under this lawn"

**Max / POV (Meta glasses):** excavator first-person full dig · skid-steer loading timelapse · one yard in one day · seam-gluing closeup (satisfying) · turf roll carry & unroll · plate compactor ASMR · court striping POV · demo day · 6am truck loadout · finished-yard reveal walkthrough · what's in our trailer · rain-day welding shop POV

**Crew field proof (formats):** 30-second narrated "before" walkthrough · mid-job process clip · after reveal (homeowner reaction if willing) · 10-shot before/after photo checklist

**Service spotlights (one flagship video each):** xeriscape · lot clearing · pavers · turf · tree removal · excavation · stone work · site prep · concrete · courts · fencing · welding · landscape design

**Seasonal/local:** Austin water-restriction news-jacking · freeze-damage cleanup (January) · bluebonnet-season xeriscape · summer "backyard ready" series · holiday-hosting patio push · spring league court rush

**Community/PR:** sponsor a local pickleball tournament · community project giveaway · supplier collab (Whittlesey yard tour) · crew spotlight series · client story testimonials · "Ask a Turf Guy" Q&A shorts answering real comments

*(≈60 seeded ideas total)*

---

## 6. Content library architecture

- **Google Drive = master library.** All raw + final files. Folder convention: `Marketing-Content/YYYY/MM/<job-or-topic>/` with an `_intake/` folder where crews and Max drop unsorted footage. (Lives under the existing `06_Brand_Marketing` Drive area.)
- **YouTube = distribution, not storage.** Public for educational/POV; unlisted for client-facing or pre-release. Compressed output only — never the archive.
- **Supabase = metadata only.** `content_items` rows: title, type, status, service line, creator, Drive URL, YouTube URL, channels published, dates. Kilobytes per item; effectively $0. No video bytes in Supabase — file storage egress ($0.09/GB beyond plan) would charge per view for no benefit.
- **App library page** = the searchable index: filter by service line / type / status / creator; share = copy the Drive or YouTube link.

---

## 7. App design — `/marketing`

### 7.1 Navigation

Flip the Marketing workspace in the AppSwitcher from `comingSoon` to live. Tools: Dashboard (`/marketing`), Referrals (`/marketing/referrals`), Campaigns (`/marketing/campaigns`), Content (`/marketing/content`), Playbook (`/marketing/playbook`). The existing dashboard "Active campaigns — coming soon" stat wires to real data.

### 7.2 Pages

| Page | Contents |
|---|---|
| `/marketing` | Tiles: active campaigns · calls this week vs target · referral funnel (called → referred → quoted → signed → paid) · **rewards due (action!)** · content published this week vs target · idea-bank count. Recent activity feed |
| `/marketing/referrals` | Roster table (filter by status/owner/segment), one-click outcome logging, "Export Reevo CSV" button, referral ledger with stage + reward columns, reward fulfillment actions |
| `/marketing/campaigns` | Campaign list + detail: brief (markdown), Jobber copy blocks with copy-to-clipboard, channel checklist, editable results |
| `/marketing/content` | Two tabs — **Pipeline** (board: idea → scripted → filmed → editing → ready → published) and **Library** (filterable index with Drive/YouTube links) |
| `/marketing/playbook` | This strategy rendered in-app (markdown from repo `docs/marketing-playbook/`), plus Troy's KPI widget and link to his recurring tasks |

### 7.3 Data model (4 new tables)

```sql
-- campaigns
id uuid pk, name text, type text check (referral|service_spotlight|seasonal|event|other),
status text check (draft|active|paused|completed) default 'draft',
brief_md text, jobber_copy jsonb,            -- [{label, subject, body}]
channels jsonb,                               -- [{channel, planned_on, done_at}]
service_line text, starts_on date, ends_on date,
results jsonb, created_by_id uuid fk profiles, created_at, updated_at

-- referral_outreach (call roster)
id uuid pk, campaign_id uuid fk, jobber_client_id text,
client_name text, client_phone text, client_city text,   -- cached snapshot
segment text check (residential|b2b_partner) default 'residential',
owner_id uuid fk profiles,
call_status text check (queued|no_answer|declined|referred|do_not_call|invalid_number) default 'queued',
attempts int default 0, last_called_at timestamptz, notes text,
unique (campaign_id, jobber_client_id)

-- referrals (ledger)
id uuid pk, campaign_id uuid fk null, outreach_id uuid fk null,
referrer_jobber_client_id text null, referrer_name text not null,
source text check (call|jobber_link|word_of_mouth|other) default 'call',
referred_name text not null, referred_phone text, referred_email text,
service_interest text,
stage text check (lead|contacted|quoted|signed|completed_paid|lost) default 'lead',
reward_type text check (visa_250|care_plan_1yr|undecided) default 'undecided',
reward_status text check (not_earned|due|sent) default 'not_earned',
reward_sent_at timestamptz, jobber_quote_url text, jobber_job_url text,
notes text, created_at, updated_at

-- content_items
id uuid pk, title text not null,
type text check (long_video|short|pov_clip|before_after|photo_set|blog_post|other),
status text check (idea|scripted|scheduled_shoot|filmed|editing|ready|published|archived) default 'idea',
service_line text, creator_id uuid fk profiles null,
drive_url text, youtube_url text, published_channels jsonb,
hook text, job_ref text, shot_on date, published_on date,
created_by_id uuid fk profiles, created_at, updated_at
```

Constraint: when `referrals.stage = 'completed_paid'` and `reward_status = 'not_earned'`, app flips `reward_status = 'due'` (server action, not trigger, to keep logic visible).

**RLS:** all authenticated users read; write restricted to admin + marketing-department members, mirroring existing department-scoped policy patterns (exact pattern verified at implementation against current policies).

**Reevo CSV export columns:** `first_name, last_name, phone, email, street, city, note (last job + season), owner`.

### 7.4 Reuse of existing rails

- **Roster source:** `jobber_clients` mirror (column names verified at implementation; sync already live).
- **Accountability:** recurring tasks via existing `tasks` + `recurring_rules` (Troy's Mon/Wed/Thu/Fri cycle, Max's 2-3 clips/week); seeded under the Marketing department.
- **Scoreboard:** `team_kpi_definitions` + entries — seed: `referral_calls_made` (weekly/caller), `referrals_captured` (weekly), `long_videos_published` (weekly), `shorts_published` (weekly), `field_clips_collected` (weekly), `referred_revenue` (monthly).
- **Jobber sends:** copy blocks in campaign detail + copy-to-clipboard; channel checklist marked manually. No new send infrastructure.

### 7.5 Seeds (shipped with Phase 1/2)

1. Campaign row: "Referral Thank-You Blitz 2026" (type `referral`, brief = §3 condensed, Jobber copy = §3.5).
2. Campaign rows for Jul–Sep spotlights (type `service_spotlight`, status `draft`).
3. ~60 `content_items` at status `idea` (§5.4) + Troy's 12-week calendar as `idea` items tagged by week.
4. KPI definitions (§7.4) and recurring task rules for Troy/Max.
5. Playbook markdown under `docs/marketing-playbook/` (program docs rendered at `/marketing/playbook`).

### 7.6 Build phases

| Phase | Ships | Definition of done |
|---|---|---|
| **1 — Referral hub** | Migration (4 tables) + `/marketing` shell + `/marketing/referrals` (roster build, outcome logging, ledger, reward flips, Reevo CSV) + referral campaign seed | Team can build roster, export to Reevo, log outcomes, track a referral to reward-sent. Typecheck/lint green, deployed |
| **2 — Content engine** | `/marketing/content` pipeline + library, playbook page, recurring tasks + KPI seeds, idea bank seed | Troy's cycle live with visible scoreboard; library indexes Drive/YouTube links |
| **3 — Campaigns + dashboard** | `/marketing/campaigns` CRUD + copy blocks, dashboard tiles wired (incl. existing "Active campaigns" stat), spotlight seeds | Spotlight kit runnable end-to-end for July |

Each phase: typecheck + lint gates, committed and deployed via the repo's `/ship` flow before the next begins.

### 7.7 Edge cases

- **Duplicate referral** (two clients refer the same person): first ledger entry wins the reward; second noted on the record.
- **Self-referral:** not eligible (referrer ≠ referred household/company).
- **Do-not-call:** permanent flag on outreach; excluded from all future rosters.
- **Client with multiple completed jobs:** one roster row (unique constraint).
- **Reward disputes / exceptions:** admin can override `reward_status` with a required note.
- **Upset client on a call:** outcome logged as service issue in notes; no pitch; surfaced in the activity feed for follow-up.

### 7.8 Testing & verification

Per repo norms: `pnpm typecheck` + `pnpm lint` must pass (enforced by `/ship`). Manual verification per phase: roster generation against real synced clients, CSV opens clean in Reevo import, outcome logging round-trip, reward flip on stage change, RLS spot-check (field-role user cannot write marketing tables). Browser-preview verification of each page before deploy.

---

## 8. KPIs (program-level)

| Metric | Target (first 90 days) |
|---|---|
| Past clients called | 100% of eligible roster in 6 weeks |
| Referred quotes | ≥15 |
| Closed referred jobs | ≥5 |
| Troy long videos | 12 |
| Shorts published | ≥60 |
| Field content | before/after set from every completed job |
| New service-line leads | baseline established per spotlight, growth tracked monthly |

---

## 9. Open questions (tracked, non-blocking)

1. **Reevo list import format / API** — verify CSV import fields in Reevo UI; revisit direct API push in Phase 3+.
2. **Jobber Marketing Suite purchase** (~$79/mo Reviews+Campaigns+Referrals vs $29 Campaigns only) — recommend the suite (Reviews is the local-SEO lever); Stefan decides.
3. **Average job value** — plug into referral math when confirmed; affects targets only.
4. **Call owners + seats in Reevo** — proposal: Colin + Troy/office; Stefan assigns.
5. **Care Plan renewal price** — $299/yr proposed; confirm before month-11 renewals.
6. **Gift card procurement** — who buys/stores cards; fulfillment logged in app either way.
7. **GHL/AGM shutoff checklist** — migrate Colin's re-engagement sequences and Meta Pixel/CAPI attribution to Reevo before cancellation (tracked in Knowledge Base, not this build).

---

## 10. Out of scope

- In-app email/SMS sending of any kind
- Storing video files in Supabase
- Reevo API integration (v1 is CSV)
- Public referral landing page (Jobber Referrals links cover this; revisit later)
- Changes to the existing paid-ads plan (continues as designed in the 2026 marketing plan)
- Migrating the GHL/AGM re-engagement SOP (separate effort, tracked in vault)
