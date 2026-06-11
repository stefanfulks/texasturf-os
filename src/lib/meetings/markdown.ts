import type { Meeting } from "./types";
import { formatOccurrence } from "./cadence";
import { refsToMarkdown } from "@/lib/refs";

export type RenderItem = {
  id: string;
  section_key: string;
  title: string;
  body: string | null;
  status: string;
  authorName: string;
  ownerName: string | null;
  dueDate: string | null;
};

/**
 * Renders the full meeting agenda as Markdown — including meeting details,
 * the agenda table, and every section populated with this occurrence's
 * items. Designed to be pasted into a fresh Google Doc with the structure
 * intact.
 */
export function renderMeetingMarkdown(
  meeting: Meeting,
  occursOn: string,
  items: RenderItem[],
  // Origin makes #ref links absolute so they work when pasted into Google Docs.
  origin = "",
): string {
  const lines: string[] = [];

  const bySection: Record<string, RenderItem[]> = {};
  for (const s of meeting.sections) bySection[s.key] = [];
  for (const item of items) {
    if (item.status === "archived") continue;
    (bySection[item.section_key] ??= []).push(item);
  }

  lines.push(`# ${meeting.name}`);
  lines.push("");
  if (meeting.description) {
    lines.push(`_${meeting.description}_`);
    lines.push("");
  }

  lines.push("## Meeting Details");
  lines.push("");
  lines.push(`**Meeting Time:** ${formatOccurrence(occursOn, meeting)}`);
  if (meeting.duration_min) lines.push(`**Duration:** ${meeting.duration_min} min`);
  lines.push("");

  if (meeting.sections.length) {
    lines.push("## Agenda");
    lines.push("");
    lines.push("| # | Agenda Item | Time | Owner |");
    lines.push("|---|---|---|---|");
    meeting.sections.forEach((s, idx) => {
      const time = s.time_min ? `${s.time_min} min` : "—";
      const owner = s.owner ?? "—";
      lines.push(`| ${idx + 1} | ${s.label} | ${time} | ${owner} |`);
    });
    lines.push("");
  }

  lines.push("## Detailed Agenda Items");
  lines.push("");
  meeting.sections.forEach((s, idx) => {
    const sectionItems = bySection[s.key] ?? [];
    const time = s.time_min ? ` (${s.time_min} min)` : "";
    const owner = s.owner ? ` — ${s.owner}` : "";
    lines.push(`### ${idx + 1}. ${s.label}${time}${owner}`);
    lines.push("");
    if (sectionItems.length === 0) {
      lines.push("_No items filed for this section._");
    } else {
      for (const item of sectionItems) {
        const tags: string[] = [];
        if (item.status === "done") tags.push("✅ DONE");
        else if (item.status === "discussed") tags.push("✓ discussed");
        if (item.status === "carried_over") tags.push("↻ carried over");
        if (item.ownerName) tags.push(`Owner: ${item.ownerName}`);
        if (item.dueDate) tags.push(`Due ${item.dueDate}`);
        const tagStr = tags.length ? `  _${tags.join(" · ")}_` : "";
        lines.push(`- **${refsToMarkdown(item.title, origin)}**${tagStr}`);
        if (item.body) {
          const body = refsToMarkdown(item.body, origin)
            .trim()
            .split("\n")
            .map((l) => "    " + l)
            .join("\n");
          lines.push(body);
        }
        lines.push(`  _Filed by ${item.authorName}_`);
      }
    }
    lines.push("");
  });

  return lines.join("\n");
}
