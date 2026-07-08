-- Content funnel rebuild: adds the fields the new drag-and-drop board needs
-- (tag shown on the card face, who films it, and the full play-by-play detail
-- filled in once an idea moves past "idea") + seeds ~100 fresh content ideas
-- across the four filming pillars. Additive only; existing rows are untouched
-- (new columns are nullable).

do $$ begin
  create type public.content_assignee as enum ('warehouse', 'ivana', 'stefan', 'troy');
exception when duplicate_object then null; end $$;

alter table public.content_items
  add column if not exists tag          text,          -- short card-face label, e.g. "101/FAQ", "Ad Creative"
  add column if not exists assignee     public.content_assignee,
  add column if not exists script_md    text,           -- full script / talking points
  add column if not exists shot_list_md text,           -- numbered shot list
  add column if not exists b_roll_md    text,           -- b-roll / cutaway ideas
  add column if not exists props_md     text;           -- props / wardrobe / location needs

create index if not exists content_items_assignee_idx
  on public.content_items (assignee) where assignee is not null;

-- ─── Seed: 100 content ideas across the four filming pillars ────────────────
-- warehouse = POV/b-roll from job sites and the yard
-- ivana     = lifestyle / family / home-aesthetic content
-- stefan    = cost/ROI/comparison talking-head + paid ad creative
-- troy      = educational 101/FAQ, long-form YouTube

insert into public.content_items (title, type, status, tag, assignee, service_line, hook)
select v.title, v.type::public.content_item_type, 'idea'::public.content_item_status,
       v.tag, v.assignee::public.content_assignee, v.service_line, v.hook
from (values
  -- ── WAREHOUSE (POV / b-roll, job-site + yard raw footage) ─────────────────
  ('Roll unload at the yard — forklift POV',            'pov_clip', 'POV/B-Roll',     'warehouse', 'turf',       'Yard ops'),
  ('Cutting turf to fit a curved bed — POV',             'pov_clip', 'POV/B-Roll',     'warehouse', 'turf',       'Precision cut'),
  ('Loading the trailer before sunrise',                 'pov_clip', 'Timelapse',      'warehouse', null,         '6am loadout'),
  ('Seaming two rolls — glue line close-up',              'pov_clip', 'POV/B-Roll',     'warehouse', 'turf',       'Seam work'),
  ('DG spreading and leveling POV',                       'pov_clip', 'POV/B-Roll',     'warehouse', 'site_prep',  'Base prep'),
  ('Compactor pass — full run POV',                       'pov_clip', 'POV/B-Roll',     'warehouse', 'site_prep',  'Plate compactor'),
  ('Weighing infill bags at the warehouse',               'short',    'Warehouse Ops',  'warehouse', 'turf',       'Behind the scenes'),
  ('Truck convoy pulling out at 6am',                      'short',    'Timelapse',      'warehouse', null,         'Morning dispatch'),
  ('Roll inventory count — warehouse floor',              'short',    'Warehouse Ops',  'warehouse', null,         'Stock day'),
  ('Cutting nailer board to length — POV',                'pov_clip', 'POV/B-Roll',     'warehouse', 'turf',       'Edging prep'),
  ('Staging a job''s full material list',                  'short',    'Warehouse Ops',  'warehouse', null,         'Pull-list day'),
  ('Loading edging bundles — POV',                         'pov_clip', 'POV/B-Roll',     'warehouse', 'turf',       'Edging load'),
  ('Forklift stacking rolls to the rafters',               'pov_clip', 'Warehouse Ops',  'warehouse', null,         'Roll storage'),
  ('Sweeping and prepping the sub-base — POV',             'pov_clip', 'POV/B-Roll',     'warehouse', 'site_prep',  'Sub-base prep'),
  ('First cut on a fresh 15x100 roll',                     'pov_clip', 'POV/B-Roll',     'warehouse', 'turf',       'Fresh roll'),
  ('Tailgate coffee before the first job',                 'short',    'Culture',        'warehouse', null,         'Crew culture'),
  ('Washing down tools at day''s end',                     'short',    'Warehouse Ops',  'warehouse', null,         'End of day'),
  ('Restocking the glue shelf',                            'short',    'Warehouse Ops',  'warehouse', 'concrete',   'Restock day'),
  ('Measuring a roll before the first cut',                'pov_clip', 'POV/B-Roll',     'warehouse', 'turf',       'Measure twice'),
  ('Warehouse morning huddle — POV',                       'short',    'Culture',        'warehouse', null,         'Daily huddle'),
  ('Pallet-jacking DG bags',                                'pov_clip', 'POV/B-Roll',     'warehouse', 'site_prep',  'Material handling'),
  ('Grinding a nailer board edge — close-up',              'pov_clip', 'POV/B-Roll',     'warehouse', 'turf',       'Edge finish'),
  ('Fitting the infill spreader attachment',               'pov_clip', 'POV/B-Roll',     'warehouse', 'turf',       'Infill setup'),
  ('End-of-day truck reload',                               'short',    'Timelapse',      'warehouse', null,         'Reload'),
  ('New hire''s first day in the warehouse',               'short',    'Culture',        'warehouse', null,         'New hire intro'),

  -- ── IVANA (lifestyle / family / home-aesthetic) ───────────────────────────
  ('Kid-safe backyard makeover reveal',                    'before_after', 'Family & Kids',      'ivana', 'turf',            'Reveal moment'),
  ('Is turf safe for toddlers? An honest answer',          'short',        'Family & Kids',      'ivana', 'turf',            'Safety Q&A'),
  ('A mom''s guide to a no-mud backyard',                  'long_video',   'Lifestyle',          'ivana', 'turf',            'Mom angle'),
  ('Styling turf with planters and string lights',         'short',        'Home Aesthetic',     'ivana', 'landscape_design','Styling tips'),
  ('Pet-friendly yard ideas for small dogs',                'short',        'Lifestyle',          'ivana', 'turf',            'Small-dog owners'),
  ('Before/after: dead grass to dream yard',                'before_after', 'Before/After (Style)','ivana', 'turf',           'Transformation'),
  ('What the neighbors said after seeing the install',      'short',        'Testimonial (Her)',  'ivana', 'turf',            'Neighbor reaction'),
  ('5 ways moms are using their new turf yard',             'short',        'Lifestyle',          'ivana', 'turf',            'Use-case roundup'),
  ('A backyard birthday party on new turf',                 'short',        'Family & Kids',      'ivana', 'turf',            'Party moment'),
  ('"I was skeptical, now I love it" — homeowner story',    'long_video',   'Testimonial (Her)',  'ivana', 'turf',            'Skeptic-to-fan'),
  ('Playset + turf pairing ideas',                          'short',        'Family & Kids',      'ivana', 'turf',            'Playset staging'),
  ('Turf ideas for small urban backyards',                  'short',        'Home Aesthetic',     'ivana', 'turf',            'Small-space design'),
  ('Design walkthrough: choosing colors and textures',       'long_video',   'Home Aesthetic',     'ivana', 'turf',            'Product walkthrough'),
  ('Client testimonial: the busy-mom edition',              'short',        'Testimonial (Her)',  'ivana', 'turf',            'Busy-mom angle'),
  ('Styling a putting green into a backyard oasis',          'short',        'Home Aesthetic',     'ivana', 'turf',            'Green staging'),
  ('Turf around the pool — safety and style',                'short',        'Lifestyle',          'ivana', 'turf',            'Pool-adjacent'),
  ('A low-maintenance yard for working parents',            'long_video',   'Lifestyle',          'ivana', 'turf',            'Time-saving angle'),
  ('"What I wish I knew before installing turf"',           'short',        'Testimonial (Her)',  'ivana', 'turf',            'Lessons learned'),
  ('Before/after: a backyard made for date nights',          'before_after', 'Before/After (Style)','ivana', 'landscape_design','Romantic staging'),
  ('Q&A: is turf hot on bare feet?',                         'short',        'Lifestyle',          'ivana', 'turf',            'Comfort Q&A'),
  ('Decorating a turf patio for fall',                      'short',        'Home Aesthetic',     'ivana', 'pavers',          'Seasonal styling'),
  ('Client walkthrough: her dream she-shed yard',           'short',        'Home Aesthetic',     'ivana', 'landscape_design','She-shed reveal'),
  ('Turf + garden bed combos that look natural',            'short',        'Home Aesthetic',     'ivana', 'landscape_design','Garden pairing'),
  ('"My dog approves" — pet reaction video',                 'short',        'Lifestyle',          'ivana', 'turf',            'Pet reaction'),
  ('Before/after: a tired lawn becomes a resort yard',       'before_after', 'Before/After (Style)','ivana', 'turf',           'Resort-style reveal'),

  -- ── STEFAN (guy talk, cost/ROI/comparison + ad creative) ──────────────────
  ('Turf ROI calculator — full walkthrough',                'long_video', 'Cost/ROI',       'stefan', 'turf',    'ROI breakdown'),
  ('Why I stopped mowing — real savings breakdown',          'long_video', 'Cost/ROI',       'stefan', 'turf',    'Savings math'),
  ('DIY vs pro install — where DIY actually fails',          'long_video', 'Comparison',     'stefan', 'turf',    'DIY pitfalls'),
  ('Ad: "$0 mowing, forever" hook test',                     'other',      'Ad Creative',    'stefan', 'turf',    'Hook test A'),
  ('Man-cave backyard: turf + grill station',               'short',      'Guy Talk',       'stefan', 'turf',    'Entertaining space'),
  ('Cost per sqft: turf vs sod vs xeriscape',                'long_video', 'Comparison',     'stefan', 'turf',    'Cost comparison'),
  ('Ad: before/after speed-reveal (15s)',                    'other',      'Ad Creative',    'stefan', 'turf',    '15s reveal ad'),
  ('"I did the math" — 5-year cost comparison',             'long_video', 'Cost/ROI',       'stefan', 'turf',    '5-year math'),
  ('Backyard sports setup for weekend warriors',             'short',      'Guy Talk',       'stefan', 'courts',  'Weekend-warrior angle'),
  ('Ad: testimonial cut-down (30s)',                         'other',      'Ad Creative',    'stefan', 'turf',    '30s testimonial ad'),
  ('Garage-to-yard: building a home gym pad',                'short',      'Guy Talk',       'stefan', 'turf',    'Home-gym pad'),
  ('Truck + trailer walkthrough — brand trust',              'short',      'Guy Talk',       'stefan', null,      'Brand/fleet trust'),
  ('Ad: "your lawn guy called — bad news" hook',            'other',      'Ad Creative',    'stefan', 'turf',    'Pain-point hook'),
  ('Why pros use different turf than big-box stores',       'long_video', 'Comparison',     'stefan', 'turf',    'Pro-grade angle'),
  ('Financing explained — Wisestack walkthrough',            'long_video', 'Cost/ROI',       'stefan', null,      'Financing explainer'),
  ('Ad: price objection handled on camera',                  'other',      'Ad Creative',    'stefan', 'turf',    'Objection handling'),
  ('Backyard putting green ROI for golfers',                 'long_video', 'Cost/ROI',       'stefan', 'turf',    'Golfer ROI'),
  ('Man-yard makeover: fire pit + turf',                     'before_after','Guy Talk',      'stefan', 'turf',    'Fire-pit yard'),
  ('Ad: local proof — "installed 3 blocks from you"',       'other',      'Ad Creative',    'stefan', 'turf',    'Local-proof ad'),
  ('Cost breakdown: what actually goes into a quote',        'long_video', 'Cost/ROI',       'stefan', 'turf',    'Quote breakdown'),
  ('Comparing 3 turf brands side by side',                   'long_video', 'Comparison',     'stefan', 'turf',    'Brand comparison'),
  ('Ad: "stop paying for water you don''t need"',           'other',      'Ad Creative',    'stefan', 'xeriscape','Water-savings ad'),
  ('Weekend warrior: install-day timelapse recap',           'short',      'Guy Talk',       'stefan', 'turf',    'Install recap'),
  ('Ad: financing hook — "$99/month" angle',                'other',      'Ad Creative',    'stefan', null,      'Financing hook ad'),
  ('Real numbers: what a bad install costs you later',       'long_video', 'Cost/ROI',       'stefan', 'turf',    'Bad-install cost'),

  -- ── TROY (educational 101/FAQ, long-form YouTube) ─────────────────────────
  ('Turf 101: how it''s actually made',                     'long_video', '101/FAQ',      'troy', 'turf',       'Manufacturing 101'),
  ('FAQ: does turf get hot in a Texas summer?',              'long_video', '101/FAQ',      'troy', 'turf',       'Heat FAQ'),
  ('FAQ: how long does turf actually last?',                 'long_video', '101/FAQ',      'troy', 'turf',       'Lifespan FAQ'),
  ('101: what''s under the turf — base layers explained',   'long_video', 'Educational',  'troy', 'site_prep',  'Base-layer 101'),
  ('FAQ: can you install turf over concrete?',               'long_video', '101/FAQ',      'troy', 'concrete',   'Concrete FAQ'),
  ('101: infill types explained — sand vs zeolite vs none',  'long_video', 'Educational',  'troy', 'turf',       'Infill 101'),
  ('FAQ: does turf smell with pets?',                        'long_video', '101/FAQ',      'troy', 'turf',       'Pet-odor FAQ'),
  ('101: seam work — why it matters',                        'long_video', 'Educational',  'troy', 'turf',       'Seam-work 101'),
  ('FAQ: is turf bad for the environment?',                  'long_video', 'Myth-Busting', 'troy', 'turf',       'Environmental myth'),
  ('101: putting green build explained',                     'long_video', 'Educational',  'troy', 'turf',       'Green-build 101'),
  ('FAQ: how much water does turf really save?',             'long_video', '101/FAQ',      'troy', 'xeriscape',  'Water-savings FAQ'),
  ('101: turf vs sod — total cost of ownership',             'long_video', 'Deep Dive',    'troy', 'turf',       'TCO deep dive'),
  ('FAQ: can you put a trampoline on turf?',                 'long_video', '101/FAQ',      'troy', 'turf',       'Trampoline FAQ'),
  ('101: what "backing weight" means when buying turf',      'long_video', 'SEO Pillar',   'troy', 'turf',       'Backing-weight 101'),
  ('FAQ: does turf void my HOA agreement?',                  'long_video', '101/FAQ',      'troy', 'turf',       'HOA FAQ'),
  ('101: how drainage works under turf',                     'long_video', 'Educational',  'troy', 'site_prep',  'Drainage 101'),
  ('FAQ: what happens to turf in a hailstorm?',              'long_video', '101/FAQ',      'troy', 'turf',       'Weather-damage FAQ'),
  ('101: commercial vs residential turf grades',             'long_video', 'Deep Dive',    'troy', 'turf',       'Grade comparison'),
  ('FAQ: can I install turf myself?',                        'long_video', '101/FAQ',      'troy', 'turf',       'DIY FAQ'),
  ('101: how tearout tiers affect your price',               'long_video', 'SEO Pillar',   'troy', 'turf',       'Tearout-pricing 101'),
  ('FAQ: does turf get slippery when wet?',                  'long_video', '101/FAQ',      'troy', 'turf',       'Wet-weather FAQ'),
  ('101: the real lifespan of turf infill',                  'long_video', 'Deep Dive',    'troy', 'turf',       'Infill-lifespan 101'),
  ('FAQ: what does the warranty actually cover?',            'long_video', '101/FAQ',      'troy', 'turf',       'Warranty FAQ'),
  ('101: choosing pile height for your use case',            'long_video', 'Educational',  'troy', 'turf',       'Pile-height 101'),
  ('FAQ: is turf worth it for renters or short-term owners?','long_video', '101/FAQ',      'troy', 'turf',       'Renter FAQ')
) as v(title, type, tag, assignee, service_line, hook)
where not exists (
  select 1 from public.content_items c where c.title = v.title
);
