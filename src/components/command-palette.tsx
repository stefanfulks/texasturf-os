"use client";

/**
 * Universal ⌘K command palette: type to search every entity in the app +
 * jump to any page. Categorized results, keyboard navigation, RLS-aware
 * search via the runSearch server action.
 *
 * Mounted once in (app)/layout so it's available on every authed page.
 * Pages render instantly from a static list (no round trip); entity hits
 * arrive from the server with a short debounce.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import {
  runSearch,
  type SearchGroup,
  type SearchHit,
  type SearchType,
} from "@/lib/search/runSearch";

// --- Pages (instant, client-side filter) ---------------------------------

const PAGES: SearchHit[] = [
  ["/dashboard", "Home"],
  ["/today", "Today"],
  ["/agenda", "Agenda"],
  ["/calendar", "Calendar"],
  ["/meetings", "Meetings"],
  ["/sales", "Sales pipeline"],
  ["/sales/materials-calculator", "Materials calculator"],
  ["/clients", "Clients"],
  ["/jobs", "Jobs"],
  ["/tasks", "Tasks"],
  ["/invoices", "Invoices"],
  ["/inventory", "Inventory"],
  ["/operations", "Operations"],
  ["/fleet/reservations", "Vehicles & equipment"],
  ["/vendors", "Vendors"],
  ["/reports", "Reports"],
  ["/attention", "Attention"],
  ["/pricing", "Pricing"],
  ["/marketing", "Marketing"],
  ["/assistant", "Turfy"],
  ["/team", "Team"],
  ["/settings", "Settings"],
  ["/settings/account", "Settings · Account"],
  ["/settings/calendar", "Settings · Calendar"],
  ["/settings/jobber", "Settings · Jobber"],
  ["/feedback", "Feedback"],
].map(([href, label]) => ({
  id: `page-${href}`,
  type: "page" as SearchType,
  label,
  href,
}));

// --- Type → badge styling -------------------------------------------------

const TYPE_LABEL: Record<string, string> = {
  page: "page",
  deal: "deal",
  contact: "contact",
  client: "client",
  job: "job",
  project: "project",
  task: "task",
  invoice: "invoice",
  vendor: "vendor",
  vehicle: "vehicle",
  meeting: "meeting",
  person: "person",
};

// --- Helpers --------------------------------------------------------------

function flatten(groups: SearchGroup[]): SearchHit[] {
  return groups.flatMap((g) => g.hits);
}

// --- Component ------------------------------------------------------------

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global ⌘K / Ctrl+K toggle + Esc. Also responds to a custom event so any
  // button in the app can open it (the header search icon for mobile + the
  // "I don't know shortcuts" crowd).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (k === "escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("command-palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("command-palette:open", onOpen);
    };
  }, [open]);

  // Reset + focus when opening. All state writes happen inside the timer
  // (async — not a synchronous effect-body setState, which the lint rule
  // forbids).
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setQuery("");
      setResults([]);
      setActive(0);
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(id);
  }, [open]);

  // Debounced search — latest query wins. All state writes happen inside the
  // timer callback for the same reason.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    let cancelled = false;
    const id = window.setTimeout(async () => {
      if (cancelled) return;
      if (q.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await runSearch(q);
        if (!cancelled) {
          setResults(data.groups);
          setActive(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [query, open]);

  // Filtered pages (always visible at the top).
  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGES.slice(0, 8);
    return PAGES.filter((p) => p.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  // The flat list the keyboard navigates: Pages group + entity groups.
  const visibleGroups: SearchGroup[] = useMemo(() => {
    const out: SearchGroup[] = [];
    if (filteredPages.length) {
      out.push({ type: "page" as SearchType, label: "Pages", hits: filteredPages });
    }
    return [...out, ...results];
  }, [filteredPages, results]);
  const flat = useMemo(() => flatten(visibleGroups), [visibleGroups]);

  // Clamp during render — derived, no setState-in-effect. `active` can drift
  // past the list as filtering shrinks results; this just renders the right
  // row as highlighted without rewriting state every render.
  const clampedActive =
    flat.length === 0 ? 0 : Math.min(active, flat.length - 1);

  const go = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      router.push(hit.href);
    },
    [router],
  );

  const onListKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const hit = flat[clampedActive];
        if (hit) {
          e.preventDefault();
          go(hit);
        }
      }
    },
    [flat, clampedActive, go],
  );

  // Scroll the active row into view as keyboard moves.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-cmd-row="${clampedActive}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [clampedActive]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={onListKey}
    >
      <button
        type="button"
        aria-label="Close search"
        className="fixed inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-[640px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search className="size-4 shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals, clients, jobs, tasks, invoices…"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-4"
          />
          {loading ? (
            <span className="text-xs text-ink-3">searching…</span>
          ) : (
            <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
              esc
            </kbd>
          )}
        </div>

        <div ref={listRef} className="max-h-[420px] overflow-y-auto p-1.5">
          {flat.length === 0 ? (
            <div className="px-3 py-10 text-center text-[13px] text-ink-3">
              {query.trim().length < 2
                ? "Type at least 2 characters."
                : loading
                  ? "Searching…"
                  : "Nothing matches that."}
            </div>
          ) : (
            visibleGroups.map((group) => (
              <Group
                key={group.type}
                group={group}
                indexOffset={flat.findIndex((h) => h.id === group.hits[0].id)}
                active={clampedActive}
                onSelect={go}
                onHover={setActive}
              />
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-canvas/60 px-3 py-1.5 text-[10.5px] text-ink-3">
          <span>
            <kbd className="rounded border border-line bg-surface px-1 py-px font-mono">↑</kbd>
            <kbd className="ml-1 rounded border border-line bg-surface px-1 py-px font-mono">↓</kbd>
            <span className="ml-1.5">navigate</span>
            <kbd className="ml-3 rounded border border-line bg-surface px-1 py-px font-mono">↵</kbd>
            <span className="ml-1.5">jump</span>
          </span>
          <span>
            <kbd className="rounded border border-line bg-surface px-1 py-px font-mono">⌘K</kbd>
            <span className="ml-1.5">to open anytime</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * A discoverable header trigger for the palette — dispatches the same
 * custom event the palette listens for, so ⌘K and the button share one
 * code path. Use anywhere the user might want to search.
 */
export function SearchButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Search (⌘K)"
      title="Search (⌘K)"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("command-palette:open"))
      }
      className={
        className ??
        "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2 text-ink-3 hover:bg-hover hover:text-ink active:bg-sunken transition-colors"
      }
    >
      <Search className="h-[18px] w-[18px]" />
      <kbd className="hidden sm:inline-block rounded border border-line bg-canvas px-1 py-px font-mono text-[10px]">
        ⌘K
      </kbd>
    </button>
  );
}

function Group({
  group,
  indexOffset,
  active,
  onSelect,
  onHover,
}: {
  group: SearchGroup;
  indexOffset: number;
  active: number;
  onSelect: (h: SearchHit) => void;
  onHover: (i: number) => void;
}) {
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="px-2.5 pt-2 pb-1 font-mono text-[9.5px] tracking-wider text-ink-3 uppercase">
        {group.label}
      </div>
      <ul className="space-y-px">
        {group.hits.map((hit, i) => {
          const idx = indexOffset + i;
          const isActive = idx === active;
          return (
            <li key={hit.id} data-cmd-row={idx}>
              <button
                type="button"
                onClick={() => onSelect(hit)}
                onMouseMove={() => onHover(idx)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                  isActive ? "bg-hover" : "hover:bg-hover"
                }`}
              >
                <span className="inline-flex h-5 items-center rounded border border-line bg-canvas px-1.5 font-mono text-[9px] tracking-wide text-ink-3 uppercase">
                  {TYPE_LABEL[hit.type] ?? hit.type}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {hit.label}
                  {hit.sublabel && (
                    <span className="ml-2 text-ink-3">{hit.sublabel}</span>
                  )}
                </span>
                {isActive && (
                  <ArrowRight className="size-3.5 shrink-0 text-ink-3" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
