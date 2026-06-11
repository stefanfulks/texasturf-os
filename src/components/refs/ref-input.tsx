"use client";

import { useEffect, useRef, useState } from "react";
import { CheckSquare, Briefcase, Receipt, UserRound, Hash } from "lucide-react";
import { searchEntities } from "@/lib/refs-search-action";
import { serializeRef, REF_TYPE_LABEL, type RefSearchResult, type RefType } from "@/lib/refs";

const REF_ICONS: Record<RefType, typeof CheckSquare> = {
  task: CheckSquare,
  project: Briefcase,
  invoice: Receipt,
  client: UserRound,
};

// Matches an in-progress "#query" before the caret. Single spaces are allowed
// inside the query ("hillman inv"); a newline or a second # ends it.
const TRIGGER = /(^|\s)#([^\n#]{0,40})$/;

type Suggestion = { start: number; query: string };

/**
 * Text input/textarea that lets people reference tasks, jobs, invoices, and
 * clients by typing `#`. Picking a result inserts a `#[Label](type:id)`
 * token, which renders as a chip wherever the text is displayed (RefText).
 */
export function RefInput({
  name,
  value,
  onChange,
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

  // Debounced server search while a #query is open. State resets happen in
  // the event handler (refreshSuggestion) — the effect only schedules I/O.
  useEffect(() => {
    const q = suggestion?.query.trim();
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
    const m = TRIGGER.exec(before);
    if (m) {
      setSuggestion({ start: caret - m[2].length - 1, query: m[2] });
      if (m[2].trim()) {
        setLoading(true);
      } else {
        setResults([]);
        setLoading(false);
      }
    } else {
      setSuggestion(null);
    }
  }

  function pick(r: RefSearchResult) {
    if (!suggestion) return;
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const token = serializeRef(r) + " ";
    const next = value.slice(0, suggestion.start) + token + value.slice(caret);
    onChange(next);
    setSuggestion(null);
    // Restore focus with the caret just after the inserted token.
    requestAnimationFrame(() => {
      el?.focus();
      const pos = suggestion.start + token.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!suggestion || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setSuggestion(null);
    }
  }

  const showDropdown = suggestion !== null && (results.length > 0 || loading || suggestion.query.trim().length > 0);

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
            {results.length === 0 ? (
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(r);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left " +
                      (i === active ? "bg-zinc-100" : "")
                    }
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
            Link a task, job, invoice, or client
          </p>
        </div>
      )}
    </div>
  );
}
