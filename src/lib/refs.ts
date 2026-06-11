// Cross-app entity references ("#refs").
//
// A ref is stored inline in plain text as `#[Label](type:id)` — e.g.
//   Pay #[Hillman — INV 1042](invoice:3f2a4c…) before Friday
// The token is self-contained (label + type + id travel together), so any
// surface that stores free text (meeting agenda items, task comments, …) can
// hold refs without schema changes, and exports degrade gracefully.

export type RefType = "task" | "project" | "invoice" | "client";

export type EntityRef = {
  type: RefType;
  id: string;
  label: string;
};

export type RefSearchResult = {
  type: RefType;
  id: string;
  label: string;
  sublabel: string | null;
};

export const REF_TYPE_LABEL: Record<RefType, string> = {
  task: "Task",
  project: "Job",
  invoice: "Invoice",
  client: "Client",
};

// Jobber client ids are encoded text (may contain "=" / "-"); everything else
// is a uuid. Exclude whitespace and ")" so the token boundary is unambiguous.
const REF_PATTERN = /#\[([^\]\n]+)\]\((task|project|invoice|client):([A-Za-z0-9_=-]+)\)/g;

/** Where each ref type links. Clients have no detail page — deep-link the
 *  clients list pre-filtered by name instead. */
export function refHref(ref: EntityRef): string {
  switch (ref.type) {
    case "task":    return `/tasks/${ref.id}`;
    case "project": return `/jobs/${ref.id}`;
    case "invoice": return `/invoices/${ref.id}`;
    case "client":  return `/clients?q=${encodeURIComponent(ref.label)}`;
  }
}

export function serializeRef(ref: Pick<EntityRef, "type" | "id" | "label">): string {
  // Square brackets and parens inside the label would break the token.
  const label = ref.label.replace(/[[\]()]/g, "").trim() || REF_TYPE_LABEL[ref.type];
  return `#[${label}](${ref.type}:${ref.id})`;
}

export type RefSegment =
  | { kind: "text"; text: string }
  | { kind: "ref"; ref: EntityRef };

/** Split text into plain segments and refs, for rendering. */
export function parseRefSegments(text: string): RefSegment[] {
  const segments: RefSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(REF_PATTERN)) {
    const idx = m.index ?? 0;
    if (idx > last) segments.push({ kind: "text", text: text.slice(last, idx) });
    segments.push({ kind: "ref", ref: { label: m[1], type: m[2] as RefType, id: m[3] } });
    last = idx + m[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

/** `#[Label](type:id)` → `#Label` — for plain-text contexts. */
export function stripRefMarkup(text: string): string {
  return text.replace(REF_PATTERN, (_m, label) => `#${label}`);
}

/** Refs → real markdown links, for the copy-as-Markdown export.
 *  `origin` (e.g. window.location.origin) makes links absolute so they
 *  survive being pasted into Google Docs. */
export function refsToMarkdown(text: string, origin = ""): string {
  return text.replace(REF_PATTERN, (_m, label, type, id) => {
    const href = refHref({ label, type: type as RefType, id });
    return `[${label}](${origin}${href})`;
  });
}
