"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { createMeeting } from "./actions";
import type { MeetingCadence, MeetingSection, SectionAccent } from "@/lib/meetings/types";

const fieldCls =
  "w-full h-12 text-base border border-zinc-300 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 bg-white";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROLES = [
  { key: "admin",  label: "Admin" },
  { key: "office", label: "Office" },
  { key: "field",  label: "Field" },
];
const DEPARTMENTS = [
  { key: "sales",     label: "Sales" },
  { key: "warehouse", label: "Warehouse" },
  { key: "office",    label: "Office" },
  { key: "field",     label: "Field" },
  { key: "marketing", label: "Marketing" },
  { key: "financial", label: "Financial" },
];

const ACCENTS: SectionAccent[] = ["amber", "emerald", "blue", "purple", "orange", "red", "zinc", "indigo"];

// Pre-built section templates so admins don't have to start blank.
const TEMPLATES: { name: string; sections: MeetingSection[] }[] = [
  {
    name: "Quick sync (3 sections)",
    sections: [
      { key: "wins",    label: "Wins",     emoji: "🎉", time_min: 5,  accent: "amber", placeholder: "What went right this week?" },
      { key: "blocker", label: "Blockers", emoji: "🚧", time_min: 10, accent: "red",   placeholder: "What's in the way?", wants_owner: true },
      { key: "action",  label: "Action Items", emoji: "✅", time_min: 5, accent: "zinc",  placeholder: "Who's doing what?", wants_owner: true, wants_due: true, is_action: true },
    ],
  },
  {
    name: "Sales huddle",
    sections: [
      { key: "wins",     label: "Wins & Closes",      emoji: "🎉", time_min: 5,  accent: "amber",   placeholder: "Closed deal, big quote sent" },
      { key: "pipeline", label: "Pipeline Movement",  emoji: "📈", time_min: 10, accent: "blue",    placeholder: "Hot lead, stalled quote" },
      { key: "leads",    label: "New Leads",          emoji: "🌱", time_min: 5,  accent: "emerald", placeholder: "Source and quality" },
      { key: "blocker",  label: "Blockers",           emoji: "🚧", time_min: 5,  accent: "red",     placeholder: "What's stuck?", wants_owner: true },
      { key: "action",   label: "Action Items",       emoji: "✅", time_min: 5,  accent: "zinc",    placeholder: "Follow-ups", wants_owner: true, wants_due: true, is_action: true },
    ],
  },
  {
    name: "Field morning meeting",
    sections: [
      { key: "today",     label: "Today's Schedule", emoji: "📅", time_min: 5, accent: "indigo",  placeholder: "Sites and crews" },
      { key: "materials", label: "Materials & Trucks", emoji: "🚜", time_min: 5, accent: "orange", placeholder: "What's loaded, what's missing" },
      { key: "safety",    label: "Safety Notes",     emoji: "⚠️",  time_min: 3, accent: "red",     placeholder: "Heat, hazards, gear" },
      { key: "blocker",   label: "Blockers",         emoji: "🚧", time_min: 5, accent: "red",     placeholder: "What needs the office to unblock?", wants_owner: true },
    ],
  },
  {
    name: "Blank — I'll build my own",
    sections: [
      { key: "general", label: "General", emoji: "📝", time_min: 10, accent: "zinc" },
    ],
  },
];

// "Sales Huddle!" → "sales-huddle". Spaces and symbols become dashes so
// people can type natural names without hitting the no-spaces slug rule.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function MeetingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Slug follows the name until the user edits the slug field directly.
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  // Cadence + day-of-week control which date fields show.
  const [cadence, setCadence] = useState<MeetingCadence>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(5); // Fri
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [scheduledOn, setScheduledOn] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Access — empty means "everyone".
  const [roles, setRoles] = useState<string[]>([]);
  const [depts, setDepts] = useState<string[]>([]);

  // Sections editor.
  const [sections, setSections] = useState<MeetingSection[]>(TEMPLATES[0].sections);

  function toggle(arr: string[], setArr: (v: string[]) => void, key: string) {
    setArr(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);
  }

  function applyTemplate(idx: number) {
    setSections(JSON.parse(JSON.stringify(TEMPLATES[idx].sections)));
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      { key: `section-${prev.length + 1}`, label: "New Section", emoji: "📝", time_min: 5, accent: "zinc" },
    ]);
  }

  function updateSection(idx: number, patch: Partial<MeetingSection>) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    // Inject sections as JSON.
    fd.set("sections", JSON.stringify(sections));
    startTransition(async () => {
      const result = await createMeeting({ status: "idle" }, fd);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      if (result.status === "success") {
        setSuccess(result.slug);
        router.push(`/meetings/${result.slug}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basics */}
      <Section title="Basics">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name" required>
            <input
              name="name"
              required
              placeholder="Sales Huddle"
              className={fieldCls}
              onChange={(e) => {
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="URL slug" required hint="Auto-generated from name">
            <input
              name="slug"
              required
              pattern="[a-z0-9-]+"
              placeholder="sales-huddle"
              className={fieldCls}
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                // Sanitize as they type instead of rejecting on submit —
                // spaces become dashes, uppercase folds to lowercase.
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
              }}
            />
          </Field>
        </div>
        <Field label="Description" optional>
          <textarea
            name="description"
            rows={2}
            placeholder="Short summary of the meeting's purpose"
            className="w-full text-base border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 placeholder:text-zinc-400 resize-none"
          />
        </Field>
      </Section>

      {/* Cadence */}
      <Section title="When does it happen?">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-2">Cadence</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {(["once", "daily", "weekly", "biweekly", "monthly", "adhoc"] as MeetingCadence[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                className={
                  "h-11 px-2 rounded-xl border text-xs font-semibold capitalize transition-colors " +
                  (cadence === c
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50")
                }
              >
                {c === "biweekly" ? "Bi-weekly" : c === "once" ? "One-time" : c}
              </button>
            ))}
          </div>
          <input type="hidden" name="cadence" value={cadence} />
        </div>

        {(cadence === "weekly" || cadence === "biweekly") && (
          <Field label="Day of week" required>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDayOfWeek(i)}
                  className={
                    "h-11 rounded-xl border text-xs font-semibold transition-colors " +
                    (dayOfWeek === i
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <input type="hidden" name="day_of_week" value={dayOfWeek} />
          </Field>
        )}

        {cadence === "once" && (
          <Field label="Meeting date" required>
            <input
              type="date"
              name="scheduled_on"
              required
              value={scheduledOn}
              onChange={(e) => setScheduledOn(e.target.value)}
              className={fieldCls}
            />
          </Field>
        )}

        {cadence === "monthly" && (
          <Field label="Day of month" required>
            <input
              type="number"
              name="day_of_month"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10) || 1)}
              className={fieldCls}
            />
          </Field>
        )}

        {cadence !== "adhoc" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start time" optional>
              <input type="time" name="start_time" defaultValue="07:00" className={fieldCls} />
            </Field>
            <Field label="Duration (min)" optional>
              <input type="number" name="duration_min" min={5} max={480} defaultValue={60} className={fieldCls} />
            </Field>
          </div>
        )}
      </Section>

      {/* Access */}
      <Section title="Who can see this meeting?" hint="Leave both empty to make it visible to everyone">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-2">Roles</label>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => {
              const on = roles.includes(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => toggle(roles, setRoles, r.key)}
                  className={
                    "h-10 px-4 rounded-full border text-xs font-semibold transition-colors " +
                    (on
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50")
                  }
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          {roles.map((r) => <input key={r} type="hidden" name="allowed_roles" value={r} />)}
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-2">Departments</label>
          <div className="flex flex-wrap gap-1.5">
            {DEPARTMENTS.map((d) => {
              const on = depts.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggle(depts, setDepts, d.key)}
                  className={
                    "h-10 px-4 rounded-full border text-xs font-semibold transition-colors " +
                    (on
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50")
                  }
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          {depts.map((d) => <input key={d} type="hidden" name="allowed_departments" value={d} />)}
        </div>
      </Section>

      {/* Sections */}
      <Section title="Agenda sections" hint="People file items into one of these — and the rendered doc groups them this way">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-2">Start from a template</label>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t, idx) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTemplate(idx)}
                className="h-10 px-3 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:border-zinc-400 active:bg-zinc-50"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 mt-3">
          {sections.map((s, idx) => (
            <div key={idx} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={s.emoji}
                  onChange={(e) => updateSection(idx, { emoji: e.target.value })}
                  className="w-12 h-11 text-center text-base border border-zinc-300 rounded-lg bg-white"
                  aria-label="Emoji"
                />
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => updateSection(idx, { label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `section-${idx + 1}` })}
                  placeholder="Section name"
                  className="flex-1 h-11 text-base border border-zinc-300 rounded-lg px-3 bg-white"
                />
                <button
                  type="button"
                  onClick={() => removeSection(idx)}
                  aria-label="Remove section"
                  className="h-11 w-11 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">Time (min)</span>
                  <input
                    type="number"
                    min={0}
                    value={s.time_min ?? ""}
                    onChange={(e) => updateSection(idx, { time_min: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                    className="w-full h-10 mt-0.5 text-sm border border-zinc-300 rounded-lg px-2 bg-white"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">Owner label</span>
                  <input
                    type="text"
                    value={s.owner ?? ""}
                    onChange={(e) => updateSection(idx, { owner: e.target.value || undefined })}
                    placeholder="Stefan, All, etc."
                    className="w-full h-10 mt-0.5 text-sm border border-zinc-300 rounded-lg px-2 bg-white"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={s.accent ?? "zinc"}
                  onChange={(e) => updateSection(idx, { accent: e.target.value as SectionAccent })}
                  className="h-9 text-xs border border-zinc-300 rounded-lg px-2 bg-white"
                >
                  {ACCENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <label className="inline-flex items-center gap-1 text-xs text-zinc-700">
                  <input type="checkbox" checked={s.wants_owner ?? false} onChange={(e) => updateSection(idx, { wants_owner: e.target.checked })} />
                  Owner picker
                </label>
                <label className="inline-flex items-center gap-1 text-xs text-zinc-700">
                  <input type="checkbox" checked={s.wants_due ?? false} onChange={(e) => updateSection(idx, { wants_due: e.target.checked })} />
                  Due date
                </label>
                <label className="inline-flex items-center gap-1 text-xs text-zinc-700">
                  <input type="checkbox" checked={s.is_action ?? false} onChange={(e) => updateSection(idx, { is_action: e.target.checked })} />
                  Action item
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addSection}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-dashed border-zinc-300 text-xs font-medium text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
        >
          <Plus className="h-3.5 w-3.5" />
          Add section
        </button>
      </Section>

      {error && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Meeting created. Redirecting…</p>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white to-transparent">
        <button
          type="submit"
          disabled={pending}
          className="block w-full h-12 rounded-xl bg-zinc-900 text-base font-semibold text-white hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create meeting"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label, hint, required, optional, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs font-semibold text-zinc-700 mb-1.5">
        <span>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
          {optional && <span className="font-normal text-zinc-400 ml-1">(optional)</span>}
        </span>
        {hint && <span className="font-normal text-zinc-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
