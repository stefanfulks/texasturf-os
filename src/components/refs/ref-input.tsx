"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Briefcase, Receipt, UserRound, Hash } from "lucide-react";
import { searchEntities } from "@/lib/refs-search-action";
import { serializeRef, REF_TYPE_LABEL, type RefSearchResult, type RefType } from "@/lib/refs";

const REF_ICONS: Record<RefType, typeof CheckSquare> = {
  task: CheckSquare,
  project: Briefcase,
  invoice: Receipt,
  client: UserRound,
};

// In-progress "#query" before the caret. Single spaces are allowed inside the
// query ("hillman inv"); a newline or a second # ends it.
const REF_TRIGGER = /(^|\s)#([^\n#]{0,40})$/;
// In-progress "@query" — same shape the task-comment mentions always used.
const PERSON_TRIGGER = /(^|\s)@([\w-]*)$/;

type Profile = { id: string; full_name: string | null; email: string };

type Suggestion = { kind: "ref" | "person"; start: number; query: string };

/**
 * Text input/textarea with inline linking:
 *  - `#` references tasks, jobs, invoices, and clients — inserts a
 *    `#[Label](type:id)` token that RefText renders as a chip.
 *  - `@` mentions people (only when `profiles` is provided) — inserts
 *    `@Name` and tracks the picked ids in `mentions` for the caller's
 *    notification path.
 */
export function RefInput({
  name,
  value,
  onChange,
  profiles,
  mentions,
  onMentionsChange,
  multiline = false,
  rows = 4,
  placeholder,
  className,
  required,
  autoFocus,
  dropdownPosition = "below",
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  /** Enables @mentions when provided. */
  profiles?: Profile[];
  mentions?: string[];
  onMentionsChange?: (v: string[]) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  required?: boolean;
  autoFocus?: boolean;
  dropdownPosition?: "above" | "below";
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [results, setResults] = useState<RefSearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  // Client-side people filter (profiles are already loaded by the page).
  const people = useMemo(() => {
    if (suggestion?.kind !== "person" || !profiles) return [];
    const q = suggestion.query.toLowerCase();
    if (!q) return profiles.slice(0, 6);
    return profiles
      .filter((p) => {
        const n = (p.full_name ?? "").toLowerCase();
        const local = p.email.split("@")[0].toLowerCase();
        return n.includes(q) || local.includes(q);
      })
      .slice(0, 6);
  }, [profiles, suggestion]);

  // Debounced server search while a #query is open. State resets happen in
  // the event handler (refreshSuggestion) — the effect only schedules I/O.
  useEffect(() => {
    if (suggestion?.kind !== "ref") return;
    const q = suggestion.query.trim();
    if (!q) return;
    const handle = setTimeout(async () => {
      try {
        const found = await searchEntities(q);
        setResults(found);
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [suggestion]);

  function refreshSuggestion(el: HTMLInputElement | HTMLTextAreaElement) {
    const caret = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, caret);

    const personMatch = profiles ? PERSON_TRIGGER.exec(before) : null;
    if (personMatch) {
      setSuggestion({ kind: "person", start: caret - personMatch[2].length - 1, query: personMatch[2] });
      setActive(0);
      return;
    }

    const refMatch = REF_TRIGGER.exec(before);
    if (refMatch) {
      setSuggestion({ kind: "ref", start: caret - refMatch[2].length - 1, query: refMatch[2] });
      if (refMatch[2].trim()) {
        setLoading(true);
      } else {
        setResults([]);
        setLoading(false);
      }
      return;
    }

    setSuggestion(null);
  }

  function insertAtSuggestion(token: string) {
    if (!suggestion) return;
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const next = value.slice(0, suggestion.start) + token + value.slice(caret);
    onChange(next);
    setSuggestion(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = suggestion.start + token.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  function pickRef(r: RefSearchResult) {
    insertAtSuggestion(serializeRef(r) + " ");
  }

  function pickPerson(p: Profile) {
    const display = (p.full_name ?? p.email.split("@")[0]).replace(/\s+/g, "");
    insertAtSuggestion(`@${display} `);
    if (mentions && onMentionsChange && !mentions.includes(p.id)) {
      onMentionsChange([...mentions, p.id]);
    }
  }

  const activeList: number = suggestion?.kind === "person" ? people.length : results.length;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!suggestion) return;
    if (e.key === "Escape") {
      setSuggestion(null);
      return;
    }
    if (activeList === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % activeList);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + activeList) % activeList);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (suggestion.kind === "person") pickPerson(people[active]);
      else pickRef(results[active]);
    }
  }

  const showDropdown =
    suggestion?.kind === "person"
      ? people.length > 0
      : suggestion !== null && (results.length > 0 || loading || suggestion.query.trim().length > 0);

  const shared = {
    name,
    value,
    placeholder,
    required,
    autoFocus,
    className,
    onKeyDown: handleKeyDown,
    onBlur: () => setTimeout(() => setSuggestion(null), 150),
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => refreshSuggestion(e.currentTarget),
  } as const;

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          {...shared}
          ref={(el) => { inputRef.current = el; }}
          rows={rows}
          onChange={(e) => {
            onChange(e.target.value);
            refreshSuggestion(e.currentTarget);
          }}
        />
      ) : (
        <input
          {...shared}
          ref={(el) => { inputRef.current = el; }}
          type="text"
          onChange={(e) => {
            onChange(e.target.value);
            refreshSuggestion(e.currentTarget);
          }}
        />
      )}

      {showDropdown && (
        <div
          className={
            "absolute left-0 right-0 z-50 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden " +
            (dropdownPosition === "above" ? "bottom-full mb-1" : "top-full mt-1")
          }
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {suggestion?.kind === "person" ? (
              people.map((p, i) => {
                const display = p.full_name ?? p.email.split("@")[0];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickPerson(p); }}
                    onMouseEnter={() => setActive(i)}
                    className={"flex w-full items-center gap-2.5 px-3 py-2 text-left " + (i === active ? "bg-zinc-100" : "")}
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-700">
                      {display[0].toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">{display}</span>
                      <span className="block truncate text-[11px] text-zinc-500">{p.email}</span>
                    </span>
                  </button>
                );
              })
            ) : results.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500">
                {loading ? "Searching…" : suggestion && suggestion.query.trim() ? "No matches — keep typing or press Esc" : "Type to search tasks, jobs, invoices, clients"}
              </p>
            ) : (
              results.map((r, i) => {
                const Icon = REF_ICONS[r.type];
                return (
                  <button
                    key={`${r.type}:${r.id}`}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickRef(r); }}
                    onMouseEnter={() => setActive(i)}
                    className={"flex w-full items-center gap-2.5 px-3 py-2 text-left " + (i === active ? "bg-zinc-100" : "")}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">{r.label}</span>
                      {r.sublabel && <span className="block truncate text-[11px] text-zinc-500">{r.sublabel}</span>}
                    </span>
                    <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {REF_TYPE_LABEL[r.type]}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <p className="flex items-center gap-1 border-t border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[10px] text-zinc-400">
            <Hash className="h-3 w-3" />
            {suggestion?.kind === "person" ? "Mention someone" : "Link a task, job, invoice, or client"}
          </p>
        </div>
      )}
    </div>
  );
}
