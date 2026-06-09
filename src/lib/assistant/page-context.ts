/**
 * Page-context scoping for Turfy.
 *
 * When Turfy is opened from a detail page (a specific task, invoice, roll,
 * or project), we want the model to know what record the user is looking
 * at so phrases like "mark this done" or "who's it assigned to" work
 * without naming the record.
 *
 * The flow:
 *   1. Client (AssistantChat / TurfyLauncher) sends the current pathname
 *      in the POST body.
 *   2. parsePageContext(pathname) → a typed PageContextRef.
 *   3. enrichPageContext(ref, supabase) hits the DB under the user's RLS
 *      context and returns a short human-readable summary (or null if the
 *      record isn't visible / doesn't exist).
 *   4. The assistant route injects the summary as a "Current page context"
 *      block at the top of the system prompt.
 *
 * RLS is the security boundary — if the user can't see the record, the
 * lookup returns null and we just don't inject context. Nothing leaks.
 */

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// ─── Types ──────────────────────────────────────────────────────────────────

export type PageContextRef =
  | { kind: "task";     id: string }
  | { kind: "invoice";  id: string }
  | { kind: "roll";     id: string }
  | { kind: "project";  id: string }
  | { kind: "other";    pathname: string };

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Map a pathname to a PageContextRef. Pure function — never touches the DB.
 * Returns `{ kind: "other" }` for routes we don't have a context schema for
 * yet (the model still sees the pathname, just no enrichment).
 */
export function parsePageContext(pathname: string | null | undefined): PageContextRef {
  if (!pathname) return { kind: "other", pathname: "" };
  // Strip query string + hash + trailing slashes for consistent matching.
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "");

  const taskMatch = path.match(/^\/tasks\/([0-9a-f-]{8,})$/i);
  if (taskMatch) return { kind: "task", id: taskMatch[1] };

  const invoiceMatch = path.match(/^\/invoices\/([0-9a-f-]{8,})(?:\/(?:edit|review|approval))?$/i);
  if (invoiceMatch) return { kind: "invoice", id: invoiceMatch[1] };

  const rollMatch = path.match(/^\/inventory\/rolls\/([^/]+)$/i);
  if (rollMatch) return { kind: "roll", id: rollMatch[1] };

  // /jobs/[id] in the UI maps to the projects table.
  const projectMatch = path.match(/^\/jobs\/([0-9a-f-]{8,})$/i);
  if (projectMatch) return { kind: "project", id: projectMatch[1] };

  return { kind: "other", pathname: path };
}

// ─── Enrichment ─────────────────────────────────────────────────────────────

/**
 * Look up a few fields about the referenced record and format them as a
 * short text block for the system prompt. Uses the user-context Supabase
 * client so RLS applies — if the user can't see the record, returns null
 * and the route injects nothing.
 */
export async function enrichPageContext(
  ref: PageContextRef,
  supabase: Supabase,
): Promise<string | null> {
  switch (ref.kind) {
    case "task": {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, assignee_id")
        .eq("id", ref.id)
        .maybeSingle();
      if (!data) return null;
      const lines: string[] = [];
      lines.push(`The user is currently viewing TASK #${data.id}.`);
      lines.push(`  title:     ${data.title}`);
      lines.push(`  status:    ${data.status}`);
      lines.push(`  priority:  ${data.priority}`);
      if (data.due_date) lines.push(`  due_date:  ${data.due_date}`);
      lines.push(`When the user says "this task" or "this", interpret it as the task above. Use its title verbatim when calling propose_update_task_status so the lookup hits it.`);
      return lines.join("\n");
    }

    case "invoice": {
      const { data } = await supabase
        .from("invoices")
        .select("id, title, status, total_amount, invoice_number, vendor_id, customer_name, job_name")
        .eq("id", ref.id)
        .maybeSingle();
      if (!data) return null;

      // Best-effort vendor name — separate query so a missing vendor doesn't
      // block the context.
      let vendorName: string | null = null;
      if (data.vendor_id) {
        const { data: v } = await supabase
          .from("vendors")
          .select("name")
          .eq("id", data.vendor_id)
          .maybeSingle();
        vendorName = v?.name ?? null;
      }

      const lines: string[] = [];
      lines.push(`The user is currently viewing INVOICE #${data.id}.`);
      lines.push(`  title:          ${data.title}`);
      lines.push(`  status:         ${data.status}`);
      if (data.invoice_number) lines.push(`  invoice_number: ${data.invoice_number}`);
      if (vendorName)          lines.push(`  vendor:         ${vendorName}`);
      if (data.customer_name)  lines.push(`  customer:       ${data.customer_name}`);
      if (data.job_name)       lines.push(`  job:            ${data.job_name}`);
      if (data.total_amount != null) {
        const amt = `$${Number(data.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
        lines.push(`  total:          ${amt}`);
      }
      lines.push(`When the user says "this invoice" or "this", interpret it as the invoice above.`);
      return lines.join("\n");
    }

    case "roll": {
      // The route param is the roll id (uuid) — but the user-facing
      // identifier is tt_sku_tag_number. Look up by id; surface the tag.
      const { data } = await supabase
        .from("inv_rolls")
        .select("id, tt_sku_tag_number, manufacturer_roll_number, product_name, dye_lot, status, current_length_ft, width_ft, allocated_job_id")
        .eq("id", ref.id)
        .maybeSingle();
      if (!data) return null;
      const lines: string[] = [];
      lines.push(`The user is currently viewing INVENTORY ROLL #${data.id}.`);
      if (data.tt_sku_tag_number)        lines.push(`  tag:           ${data.tt_sku_tag_number}`);
      if (data.manufacturer_roll_number) lines.push(`  mfg_roll:      ${data.manufacturer_roll_number}`);
      if (data.product_name)             lines.push(`  product:       ${data.product_name}`);
      if (data.dye_lot)                  lines.push(`  dye_lot:       ${data.dye_lot}`);
      lines.push(`  status:        ${data.status}`);
      if (data.width_ft != null)         lines.push(`  width_ft:      ${data.width_ft}`);
      if (data.current_length_ft != null) lines.push(`  current_len_ft:${data.current_length_ft}`);
      if (data.allocated_job_id)         lines.push(`  allocated_job: ${data.allocated_job_id}`);
      lines.push(`When the user says "this roll" or "this", interpret it as the roll above.`);
      return lines.join("\n");
    }

    case "project": {
      // The UI calls these "Jobs", but they live in the projects table.
      const { data } = await supabase
        .from("projects")
        .select("id, name, status, type, customer_name, address, target_install_date")
        .eq("id", ref.id)
        .maybeSingle();
      if (!data) return null;
      const lines: string[] = [];
      lines.push(`The user is currently viewing JOB / PROJECT #${data.id}.`);
      lines.push(`  name:                  ${data.name}`);
      lines.push(`  type:                  ${data.type}`);
      lines.push(`  status:                ${data.status}`);
      if (data.customer_name)       lines.push(`  customer:              ${data.customer_name}`);
      if (data.address)             lines.push(`  address:               ${data.address}`);
      if (data.target_install_date) lines.push(`  target_install_date:   ${data.target_install_date}`);
      lines.push(`When the user says "this job" / "this project" / "this", interpret it as the project above.`);
      return lines.join("\n");
    }

    case "other": {
      // No enrichment — just tell the model what page they're on so any
      // contextual hints in the URL can be useful.
      if (!ref.pathname || ref.pathname === "/assistant") return null;
      return `The user is currently on the page: ${ref.pathname}. There's no record-level context for this page yet, but you can use this as a hint about what they're doing.`;
    }
  }
}
