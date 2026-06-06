/**
 * Tool definitions for the TexasTurf OS assistant. All read-only for v1.
 * Each tool runs server-side with the user's RLS context, so the assistant
 * only ever sees data the user is already allowed to see.
 *
 * To add a write tool later, define it here AND add explicit user-confirmation
 * UX in the chat surface before invoking — write tools should never run
 * silently from the model.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";
import { getMyTaskIds, NO_TASK_UUID } from "@/lib/tasks/scope";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const TOOL_DEFS: Anthropic.Tool[] = [
  {
    name: "search_tasks",
    description:
      "Find tasks by title, status, or assignee. Returns up to 20 results. Useful when the user asks 'what tasks are open?', 'what's overdue?', 'what did I assign to X?', etc.",
    input_schema: {
      type: "object",
      properties: {
        query:    { type: "string", description: "Optional free-text match against task title or description." },
        status:   { type: "string", enum: ["inbox","in_progress","waiting","blocked","done"], description: "Filter by status." },
        scope:    { type: "string", enum: ["mine","team","all"], description: "mine = assigned to current user; team = all tasks; all = same as team." },
        overdue:  { type: "boolean", description: "If true, only tasks with a due_date in the past and not done." },
      },
    },
  },
  {
    name: "search_invoices",
    description:
      "Find invoices by title, vendor, or status. Use when the user asks about money owed, what needs approval, what's been paid, etc.",
    input_schema: {
      type: "object",
      properties: {
        query:  { type: "string", description: "Free-text match against title, vendor name, invoice_number, or job name." },
        status: { type: "string", enum: ["draft","submitted","awaiting_review","awaiting_approval","approved","request_change","rejected","on_hold","paid","archived"] },
      },
    },
  },
  {
    name: "search_rolls",
    description:
      "Search inventory rolls. The TexasTurf warehouse tracks parent rolls that get cut into smaller children for jobs. Use this when the user asks 'how much TexasHaven do we have?', 'where's roll C-2X0G2GHX?', 'what's allocated to job 263?', etc.",
    input_schema: {
      type: "object",
      properties: {
        query:   { type: "string", description: "Match against tt_sku_tag_number, manufacturer_roll_number, product_name, or dye_lot." },
        status:  { type: "string", enum: ["available","planned","allocated","staged","dispatched","consumed","damaged","returned"] },
        product: { type: "string", description: "Exact product name like 'Saratoga 40' or 'TexasHaven'." },
      },
    },
  },
  {
    name: "search_vendors",
    description: "Look up vendors / subcontractors by name.",
    input_schema: {
      type: "object",
      properties: {
        query:  { type: "string", description: "Match against vendor name." },
        active: { type: "boolean", description: "If true, only active vendors. Default true." },
      },
    },
  },
  {
    name: "get_dashboard_stats",
    description:
      "Get a snapshot of the user's personal dashboard counts (tasks today, overdue, invoice attention). Use this when the user asks 'how am I doing today?' or 'what should I focus on?'",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_inventory_stats",
    description:
      "Get warehouse-wide counts: open rolls, active jobs, pending receive, low-stock items.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_notion_sops",
    description:
      "Search the TexasTurf Notion workspace for SOPs, procedures, or documents that answer a how-to question. Use this when the user asks about a process, policy, or step-by-step procedure — e.g. 'what's our SOP for receiving rolls?' or 'how do we handle damaged turf?'. Returns up to 5 matching pages with titles, URLs, and excerpts. Only available when NOTION_API_KEY is configured.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search across page titles + body." },
      },
      required: ["query"],
    },
  },
];

// ─── Tool runners ────────────────────────────────────────────────────────────

type ToolInput = Record<string, unknown>;

export async function runTool(
  name: string,
  input: ToolInput,
  supabase: Supabase,
  userId: string,
): Promise<string> {
  try {
    const result = await dispatch(name, input, supabase, userId);
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function dispatch(name: string, input: ToolInput, supabase: Supabase, userId: string) {
  switch (name) {
    case "search_tasks":         return searchTasks(input, supabase, userId);
    case "search_invoices":      return searchInvoices(input, supabase);
    case "search_rolls":         return searchRolls(input, supabase);
    case "search_vendors":       return searchVendors(input, supabase);
    case "get_dashboard_stats":  return getDashboardStats(supabase, userId);
    case "get_inventory_stats":  return getInventoryStats(supabase);
    case "search_notion_sops":   return searchNotionSops(input);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Concrete tools ──────────────────────────────────────────────────────────

async function searchTasks(input: ToolInput, supabase: Supabase, userId: string) {
  let q = supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, assignee_id, project_id")
    .neq("status", "archived")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(20);

  const scope = (input.scope as string) ?? "mine";
  if (scope === "mine") {
    // Multi-assignee: include any task where the user is tagged in
    // task_assignees, not just the legacy primary (tasks.assignee_id).
    const myIds = await getMyTaskIds(supabase, userId);
    if (myIds.length === 0) return { count: 0, tasks: [] };
    q = q.in("id", myIds);
  }

  if (typeof input.status === "string") q = q.eq("status", input.status as never);

  if (input.overdue === true) {
    const today = new Date().toISOString().slice(0, 10);
    q = q.neq("status", "done").lt("due_date", today);
  }

  if (typeof input.query === "string" && input.query.trim()) {
    const term = input.query.trim().replace(/[%_]/g, "");
    q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { count: data?.length ?? 0, tasks: data ?? [] };
}

async function searchInvoices(input: ToolInput, supabase: Supabase) {
  let q = supabase
    .from("invoices")
    .select("id, title, status, total_amount, vendor:vendor_id(name), submitted_at, invoice_number, job_name, customer_name")
    .neq("status", "archived")
    .order("submitted_at", { ascending: false })
    .limit(15);

  if (typeof input.status === "string") q = q.eq("status", input.status as never);

  if (typeof input.query === "string" && input.query.trim()) {
    const term = input.query.trim().replace(/[%_]/g, "");
    q = q.or(`title.ilike.%${term}%,invoice_number.ilike.%${term}%,job_name.ilike.%${term}%,customer_name.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { count: data?.length ?? 0, invoices: data ?? [] };
}

async function searchRolls(input: ToolInput, supabase: Supabase) {
  let q = supabase
    .from("inv_rolls")
    .select("id, tt_sku_tag_number, manufacturer_roll_number, product_name, dye_lot, status, current_length_ft, width_ft, allocated_job_id")
    .order("created_at", { ascending: false })
    .limit(20);

  if (typeof input.status === "string") q = q.eq("status", input.status as never);
  if (typeof input.product === "string") q = q.eq("product_name", input.product);
  if (typeof input.query === "string" && input.query.trim()) {
    const term = input.query.trim().replace(/[%_]/g, "");
    q = q.or(
      `tt_sku_tag_number.ilike.%${term}%,manufacturer_roll_number.ilike.%${term}%,product_name.ilike.%${term}%,dye_lot.ilike.%${term}%`,
    );
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { count: data?.length ?? 0, rolls: data ?? [] };
}

async function searchVendors(input: ToolInput, supabase: Supabase) {
  let q = supabase
    .from("vendors")
    .select("id, name, type, contact_name, email, phone, active, notes")
    .order("name", { ascending: true })
    .limit(20);

  if (input.active !== false) q = q.eq("active", true);
  if (typeof input.query === "string" && input.query.trim()) {
    const term = input.query.trim().replace(/[%_]/g, "");
    q = q.ilike("name", `%${term}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { count: data?.length ?? 0, vendors: data ?? [] };
}

async function getDashboardStats(supabase: Supabase, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  // Multi-assignee aware: count any task this user is tagged on, not just
  // their primary-assigned ones.
  const myIds = await getMyTaskIds(supabase, userId);
  const taskBase = (q: ReturnType<Supabase["from"]>) =>
    myIds.length === 0
      ? q.eq("id", NO_TASK_UUID) // forced-empty match
      : q.in("id", myIds);
  const [todayRes, overdueRes, openRes, attnRes] = await Promise.all([
    taskBase(supabase.from("tasks").select("id", { count: "exact", head: true }))
      .not("status", "in", "(done,archived)").eq("due_date", today),
    taskBase(supabase.from("tasks").select("id", { count: "exact", head: true }))
      .not("status", "in", "(done,archived)").lt("due_date", today),
    taskBase(supabase.from("tasks").select("id", { count: "exact", head: true }))
      .not("status", "in", "(done,archived)"),
    supabase.from("invoices").select("id", { count: "exact", head: true })
      .in("status", ["awaiting_review","awaiting_approval","request_change"]),
  ]);
  return {
    tasks_today:        todayRes.count   ?? 0,
    tasks_overdue:      overdueRes.count ?? 0,
    tasks_open_total:   openRes.count    ?? 0,
    invoices_attention: attnRes.count    ?? 0,
  };
}

async function searchNotionSops(input: ToolInput) {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    return {
      error:
        "Notion SOP search isn't configured. Tell the user to ask the admin to set NOTION_API_KEY in Vercel and share the SOP pages with the integration.",
    };
  }
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return { count: 0, results: [] };

  const resp = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      "Authorization":     `Bearer ${apiKey}`,
      "Notion-Version":    "2022-06-28",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      query,
      filter: { value: "page", property: "object" },
      page_size: 5,
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    return { error: `Notion API returned ${resp.status}: ${detail.slice(0, 200)}` };
  }
  const data = (await resp.json()) as {
    results?: Array<{
      id: string;
      url: string;
      properties?: Record<string, { type: string; title?: Array<{ plain_text: string }> }>;
    }>;
  };

  const results = (data.results ?? []).map((page) => {
    const titleProp = Object.values(page.properties ?? {}).find((p) => p.type === "title");
    const title = titleProp?.title?.map((t) => t.plain_text).join("") ?? "Untitled";
    return { id: page.id, title, url: page.url };
  });

  return { count: results.length, results };
}

async function getInventoryStats(supabase: Supabase) {
  const [openRolls, activeJobs, pendingReceive, lowStock] = await Promise.all([
    supabase.from("inv_rolls").select("id", { count: "exact", head: true })
      .in("status", ["available","planned"]),
    supabase.from("inv_jobs").select("id", { count: "exact", head: true })
      .in("status", ["in_progress","staged"]),
    supabase.from("inv_rolls").select("id", { count: "exact", head: true })
      .eq("status", "planned"),
    supabase.from("inv_items").select("id, quantity, min_quantity").eq("active", true),
  ]);
  const low = (lowStock.data ?? []).filter(
    (i) => i.min_quantity != null && i.quantity != null && i.quantity <= i.min_quantity,
  ).length;
  return {
    open_rolls:        openRolls.count       ?? 0,
    active_jobs:       activeJobs.count      ?? 0,
    pending_receive:   pendingReceive.count  ?? 0,
    low_stock_items:   low,
  };
}
