// Shared types for the generalized Meetings module.
// Each meeting has its own cadence and its own section structure stored as
// JSON, so a sales huddle and a leadership meeting can coexist without
// schema changes.

export type MeetingCadence = "daily" | "weekly" | "biweekly" | "monthly" | "adhoc" | "once";

export type MeetingItemStatus = "pending" | "carried_over" | "discussed" | "done" | "archived";

export type SectionAccent =
  | "amber" | "emerald" | "blue" | "purple"
  | "orange" | "red" | "zinc" | "indigo";

export type MeetingSection = {
  /** Stable key, used to bucket items into this section. */
  key: string;
  /** Display label, e.g. "Sales Quick Pulse". */
  label: string;
  emoji: string;
  /** Time budget in minutes (shown in the agenda table). */
  time_min?: number;
  /** Owner label, e.g. "Stefan" or "All". */
  owner?: string;
  accent?: SectionAccent;
  /** Placeholder shown in the file-an-item modal title field. */
  placeholder?: string;
  /** Owner picker shows in the modal. */
  wants_owner?: boolean;
  /** Due-date picker shows in the modal. */
  wants_due?: boolean;
  /** Completing an item counts as "done" instead of "discussed". */
  is_action?: boolean;
};

export type Meeting = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cadence: MeetingCadence;
  day_of_week: number | null;
  day_of_month: number | null;
  start_time: string | null;        // "HH:MM:SS"
  duration_min: number | null;
  /** The single date a cadence="once" meeting happens (YYYY-MM-DD). */
  scheduled_on: string | null;
  allowed_roles: string[];          // empty + empty departments + no invitees = open to everyone
  allowed_departments: string[];
  /** People invited directly — can see the meeting regardless of role/department. */
  invited_user_ids: string[];
  /** Google Meet link (auto-created with the calendar event, or pasted manually). */
  meet_url: string | null;
  gcal_event_id: string | null;
  sections: MeetingSection[];
  archived: boolean;
};

export type MeetingItem = {
  id: string;
  meeting_id: string;
  occurs_on: string;                // YYYY-MM-DD
  section_key: string;
  title: string;
  body: string | null;
  status: MeetingItemStatus;
  owner_id: string | null;
  due_date: string | null;
  author_id: string;
  created_at: string;
};

export const ACCENT_CLASSES: Record<SectionAccent, string> = {
  amber:   "bg-amber-50 text-amber-800 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
  blue:    "bg-blue-50 text-blue-800 border-blue-200",
  purple:  "bg-purple-50 text-purple-800 border-purple-200",
  orange:  "bg-orange-50 text-orange-800 border-orange-200",
  red:     "bg-red-50 text-red-800 border-red-200",
  zinc:    "bg-zinc-100 text-zinc-800 border-zinc-300",
  indigo:  "bg-indigo-50 text-indigo-800 border-indigo-200",
};

export const CADENCE_LABEL: Record<MeetingCadence, string> = {
  daily:    "Daily",
  weekly:   "Weekly",
  biweekly: "Every other week",
  monthly:  "Monthly",
  adhoc:    "As needed",
  once:     "One-time",
};
