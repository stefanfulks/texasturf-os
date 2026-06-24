// The slide deck is "kinds in code" (per the spec). Phase 2a defines the deck
// and its copy here as a typed, code-defined default. Phase 2b will let admins
// persist/edit decks in the DB; the kinds and renderers stay here.

export type SlideKind =
  | "cover"
  | "why_turf"
  | "savings"
  | "why_us"
  | "gallery"
  | "media"
  | "video"
  | "process"
  | "reviews"
  | "ratings"
  | "pricing"
  | "financing"
  | "close";

export type Point = { head: string; body: string };
export type GalleryPair = { label: string; beforeUrl?: string; afterUrl?: string };
export type MediaImage = { url: string; caption?: string };
export type RatingItem = { platform: string; score: string; detail?: string };

export type DeckSlide =
  | { kind: "cover"; title: string; subtitle?: string; logoUrl?: string }
  | { kind: "why_turf"; title: string; points: Point[] }
  | { kind: "savings"; title: string; note: string }
  | { kind: "why_us"; title: string; points: Point[] }
  | { kind: "gallery"; title: string; pairs: GalleryPair[] }
  | { kind: "media"; title: string; images: MediaImage[] }
  | { kind: "video"; title: string; url: string; poster?: string; caption?: string }
  | { kind: "process"; title: string; steps: Point[] }
  | { kind: "reviews"; title: string; quotes: { quote: string; name: string; city: string }[] }
  | { kind: "ratings"; title: string; subtitle?: string; items: RatingItem[] }
  | { kind: "pricing"; title: string }
  | { kind: "financing"; title: string; body: string; bullets: string[] }
  | { kind: "close"; title: string; subtitle?: string; cta: string };

// Public pitch-assets bucket (curated marketing media pulled from Drive).
const ASSET = "https://ybedvthhofoutbqgwnvm.supabase.co/storage/v1/object/public/pitch-assets";

// Seeded from the premium positioning in 01-Services/Service-Catalog.md.
// Gallery/media images are REAL (Lemon backyard + DREES putting greens). The
// `reviews` quotes remain placeholders and the testimonial `video` slide is
// added in the deck editor once the compressed MP4 is uploaded.
export const DEFAULT_DECK: DeckSlide[] = [
  { kind: "cover", title: "Your new low-maintenance yard", subtitle: "Premium artificial turf, professionally installed", logoUrl: `${ASSET}/logo-512.png` },
  {
    kind: "why_turf",
    title: "Why homeowners switch to turf",
    points: [
      { head: "Save water", body: "No watering — cut the biggest line item on your summer water bill." },
      { head: "Every weekend back", body: "No mowing, edging, or fertilizing. It looks groomed year-round." },
      { head: "Kid & pet friendly", body: "Soft, non-toxic, and drains fast after rain or a rinse-off." },
      { head: "Always green", body: "Stays lush through Texas summers and droughts — no brown patches." },
    ],
  },
  { kind: "savings", title: "What are you spending now?", note: "Drag to estimate your current lawn upkeep — most homeowners recover it in a few years." },
  {
    kind: "why_us",
    title: "Why Texas Turf",
    points: [
      { head: "Netherlands-engineered turf", body: "The premium product designers specify — ultra-realistic, multi-tone blades." },
      { head: "Zero-infill option", body: "Our Platinum turf needs no sand or crumb rubber — clean underfoot, nothing to displace." },
      { head: "Built to last", body: "15-year residential warranty. Platinum is non-pro-rated." },
      { head: "Local crews", body: "Installed across the Austin metro and Hill Country by our own experienced teams." },
    ],
  },
  {
    kind: "gallery",
    title: "Before & after",
    pairs: [
      { label: "Backyard transformation", beforeUrl: `${ASSET}/lemon-before.jpg`, afterUrl: `${ASSET}/lemon-after.jpg` },
    ],
  },
  {
    kind: "media",
    title: "See it in real Texas yards",
    images: [
      { url: `${ASSET}/lemon-lifestyle-1.jpg`, caption: "Backyard living" },
      { url: `${ASSET}/lemon-lifestyle-2.jpg`, caption: "Green year-round" },
      { url: `${ASSET}/drees-putting-green-1.jpg`, caption: "Custom putting green" },
      { url: `${ASSET}/drees-putting-green-2.jpg`, caption: "Tour-quality detail" },
    ],
  },
  {
    kind: "process",
    title: "How it works",
    steps: [
      { head: "Measure & quote", body: "We size it up today and show you exact pricing." },
      { head: "Tear-out & base", body: "Remove the old surface and build a compacted, draining base." },
      { head: "Install & seam", body: "Roll, cut, and seam the turf for a seamless finish." },
      { head: "Infill & groom", body: "Add infill (none for Platinum) and power-broom it upright." },
      { head: "Walkthrough", body: "We clean up and walk the finished yard with you." },
    ],
  },
  {
    kind: "ratings",
    title: "Trusted across the Austin metro",
    subtitle: "Rated by real homeowners on the platforms they trust.",
    items: [
      { platform: "HomeAdvisor", score: "4.8", detail: "Verified homeowner reviews" },
      { platform: "Yelp", score: "4.5", detail: "24 reviews" },
    ],
  },
  { kind: "pricing", title: "Choose your turf" },
  {
    kind: "financing",
    title: "Flexible monthly payments",
    body: "Prefer to spread it out? We offer financing through Wisestack.",
    bullets: [
      "Apply in minutes with a soft credit check",
      "Pick a monthly payment that fits your budget",
      "Set it up right inside your quote when we finalize today",
    ],
  },
  { kind: "close", title: "Ready to get started?", subtitle: "Lock in today's pricing and reserve your install date.", cta: "Reserve my install" },
];

// A slide as persisted in a deck: a DeckSlide plus an id and a hidden flag.
export type StoredSlide = DeckSlide & { id: string; hidden: boolean };

/** Build the starter deck's slides from the code default (used to seed a DB deck). */
export function defaultStoredSlides(): StoredSlide[] {
  return DEFAULT_DECK.map((s) => ({ ...s, id: s.kind, hidden: false }));
}

/** The slides a present session actually renders (drop hidden ones). */
export function visibleSlides(slides: StoredSlide[]): DeckSlide[] {
  return slides.filter((s) => !s.hidden);
}

// ── Builder field config — drives the generic copy editor in phase 2b ──
export type FieldType = "text" | "textarea" | "lines" | "labels" | "pairs" | "quotes" | "gallerypairs" | "media" | "ratings";
export type FieldDef = { key: string; label: string; type: FieldType };

export const SLIDE_FIELDS: Record<SlideKind, FieldDef[]> = {
  cover:     [{ key: "title", label: "Title", type: "text" }, { key: "subtitle", label: "Subtitle", type: "text" }, { key: "logoUrl", label: "Logo image URL", type: "text" }],
  why_turf:  [{ key: "title", label: "Title", type: "text" }, { key: "points", label: "Points — Head | Body (one per line)", type: "pairs" }],
  savings:   [{ key: "title", label: "Title", type: "text" }, { key: "note", label: "Note", type: "textarea" }],
  why_us:    [{ key: "title", label: "Title", type: "text" }, { key: "points", label: "Points — Head | Body (one per line)", type: "pairs" }],
  gallery:   [{ key: "title", label: "Title", type: "text" }, { key: "pairs", label: "Before/after — Caption | Before URL | After URL (one per line)", type: "gallerypairs" }],
  media:     [{ key: "title", label: "Title", type: "text" }, { key: "images", label: "Photos — URL | Caption (one per line)", type: "media" }],
  video:     [{ key: "title", label: "Title", type: "text" }, { key: "url", label: "Video URL (MP4)", type: "text" }, { key: "poster", label: "Poster image URL", type: "text" }, { key: "caption", label: "Caption", type: "text" }],
  process:   [{ key: "title", label: "Title", type: "text" }, { key: "steps", label: "Steps — Head | Body (one per line)", type: "pairs" }],
  reviews:   [{ key: "title", label: "Title", type: "text" }, { key: "quotes", label: "Reviews — Quote | Name | City (one per line)", type: "quotes" }],
  ratings:   [{ key: "title", label: "Title", type: "text" }, { key: "subtitle", label: "Subtitle", type: "text" }, { key: "items", label: "Ratings — Platform | Score | Detail (one per line)", type: "ratings" }],
  pricing:   [{ key: "title", label: "Title", type: "text" }],
  financing: [{ key: "title", label: "Title", type: "text" }, { key: "body", label: "Body", type: "textarea" }, { key: "bullets", label: "Bullets (one per line)", type: "lines" }],
  close:     [{ key: "title", label: "Title", type: "text" }, { key: "subtitle", label: "Subtitle", type: "text" }, { key: "cta", label: "Button label", type: "text" }],
};

export const SLIDE_KIND_LABELS: Record<SlideKind, string> = {
  cover: "Cover", why_turf: "Why turf", savings: "Savings", why_us: "Why us",
  gallery: "Before & after", media: "Photos", video: "Video", process: "Process", reviews: "Reviews",
  ratings: "Ratings", pricing: "Pricing", financing: "Financing", close: "Close",
};
