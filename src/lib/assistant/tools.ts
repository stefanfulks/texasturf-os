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
import { upcomingOccurrence } from "@/lib/meetings/cadence";
import {
  DraftTaskSchema,
  DraftCalendarEventSchema,
  DraftSlackMessageSchema,
  DraftUpdateTaskStatusSchema,
  TASK_STATUS_VALUES,
  summarizeDraft,
  type DraftTask,
  type DraftAttendee,
  type ProposeResult,
} from "@/lib/assistant/drafts";
import { lookupUserByEmail, openDM } from "@/lib/integrations/slack";
import { getAllDeals, getOpenDeals, getLastActivityMap } from "@/lib/sales/queries";
import {
  openPipelineValue,
  weightedPipeline,
  winRate,
  closingThisMonth,
} from "@/lib/sales/rollups";
import { assessDeal } from "@/lib/sales/risk";
import { today } from "@/lib/sales/dates";
import { usd } from "@/lib/sales/format";
import { STAGE_LABELS } from "@/lib/sales/labels";
import type { DealActivity, Stage } from "@/lib/sales/types";

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
  {
    name: "search_assets",
    description:
      "Search Fleet — trucks, trailers, equipment. Use when the user asks 'what trucks do we have?', 'is the F-150 ready?', 'what's down for service?', etc. Returns up to 20 results.",
    input_schema: {
      type: "object",
      properties: {
        query:        { type: "string", description: "Free-text match against asset name." },
        status:       { type: "string", enum: ["available","assigned_to_job","in_use_today","maintenance_needed","out_of_service"], description: "Filter by asset_status. Omit to list all non-archived assets." },
        unit_type:    { type: "string", description: "Filter by unit_type (e.g. 'truck', 'trailer', 'equipment')." },
        ready_status: { type: "string", description: "Filter by ready_status (e.g. 'ready', 'not_ready', 'in_service')." },
      },
    },
  },
  {
    name: "list_upcoming_maintenance",
    description:
      "List maintenance schedules coming due or overdue. Use when the user asks 'what's due for service?', 'what maintenance is overdue?', 'what's the F-150's next service?'. Returns active schedules with next_due_at within the given window (default 14 days; pass a larger number for a longer horizon).",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: { type: "number", description: "Look this many days into the future. Default 14. Pass 0 to show only overdue. Pass 90 for a quarter look-ahead." },
      },
    },
  },
  {
    name: "search_projects",
    description:
      "Search projects (the UI calls these 'Jobs'). Use when the user asks 'what jobs are in planning?', 'what's scheduled this week?', 'what's the status of the Sage Creek install?'. Returns up to 20 results.",
    input_schema: {
      type: "object",
      properties: {
        query:    { type: "string", description: "Free-text match against project name, customer_name, or address." },
        status:   { type: "string", description: "Filter by project status (intake / planning / scheduled / in_progress / blocked / complete / on_hold / cancelled / etc)." },
        type:     { type: "string", description: "Filter by project type (e.g. 'install', 'service_call')." },
      },
    },
  },
  {
    name: "search_clients",
    description:
      "Look up clients/customers synced from Jobber by name or company. Use for 'what's the Hendersons' phone number?', 'do we have a client called Sage Creek HOA?', 'what's John Smith's balance?'. Returns up to 20 with name, company, emails, phones, and outstanding balance.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Match against first name, last name, or company name." },
      },
    },
  },
  {
    name: "search_meetings",
    description:
      "Find recurring/standing meetings by name. Use for 'when is the sales sync?', 'what meetings do we have?'. Returns up to 20 with cadence, start time, and the next occurrence date.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Match against meeting name or description." },
      },
    },
  },
  {
    name: "get_today_schedule",
    description:
      "Get everything happening today for the current user: scheduled Jobber visits, meetings occurring today, and the user's own tasks due today. Use for 'what's on today?', 'what's my schedule?', 'anything due today?'. Takes no arguments.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_fleet_availability",
    description:
      "Show which fleet vehicles/equipment are free right now vs. reserved, based on active vehicle reservations. Use for 'which trucks are available?', 'is the dump trailer free this afternoon?', 'what's reserved?'. Returns each non-archived asset with available_now, its current reservation (if any), and upcoming reservations. Takes no arguments.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "pipeline_summary",
    description:
      "Sales pipeline rollups: open pipeline value, weighted (probability-adjusted) value, win rate over the last 90 days, and value expected to close this month. Use for 'how's the pipeline?', 'what's our forecast?', 'how much is closing this month?'. Takes no arguments.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "deals_needing_attention",
    description:
      "Open sales deals carrying risk flags — stalling in a stage, no next step set, expected close date passed, or gone quiet (no recent activity) — with the reason for each. Use for 'what's slipping?', 'which deals need attention?', 'what's at risk?'. Returns up to 15 amber/red deals. Takes no arguments.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_deals",
    description:
      "Search open sales deals by name/account (case-insensitive), optionally filtered by stage. Use for 'do we have a deal with the Hendersons?', 'what's in negotiation?', 'show me quote_sent deals'. Returns up to 20 with name, stage, value, and next step.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text match against deal name/account." },
        stage: { type: "string", enum: ["lead","qualified","site_visit","quote_sent","negotiation","closed_won","closed_lost"], description: "Optional stage filter. Omit to search all open deals." },
      },
    },
  },
  {
    // Write tool — name starts with `propose_` so the route layer routes the
    // result through the confirm-card flow instead of feeding it straight
    // back to the model as a normal tool_result. Nothing is written to the
    // database here; the user has to click Confirm in the UI for the
    // commit-draft endpoint to actually create the task.
    name: "propose_create_task",
    description:
      "Propose a new task. The user will see a confirm card before it's actually created — do NOT tell them it's done until they confirm. Always convert relative dates ('tomorrow', 'next Friday') to YYYY-MM-DD before calling (today's date is in your system prompt). Leave assignee_query blank to default to the current user. If the name matches multiple people, the tool returns the candidates and you ask the user which one — do NOT guess.",
    input_schema: {
      type: "object",
      properties: {
        title:        { type: "string", description: "Short title for the task. Required." },
        description:  { type: "string", description: "Optional longer body." },
        due_date:     { type: "string", description: "Optional ISO date (YYYY-MM-DD). Convert relative phrases yourself before calling." },
        assignee_query: { type: "string", description: "Optional name/email fragment to assign to (e.g. 'Mike', 'mike@'). Blank = current user." },
        priority:     { type: "string", enum: ["low","normal","high","urgent"], description: "Defaults to normal." },
      },
      required: ["title"],
    },
  },
  {
    // Write tool — schedules an event on the user's primary Google Calendar.
    // Same draft → confirm card → commit pattern as propose_create_task.
    // Requires the user to have signed in with Google (provider tokens
    // captured in /auth/callback). Commit endpoint surfaces a helpful error
    // if tokens are missing.
    name: "propose_schedule_calendar_event",
    description:
      "Propose a new event on the user's primary Google Calendar. The user will see a confirm card before it's actually created — do NOT say it's scheduled until they confirm. Times are in Central Time (America/Chicago); format start_iso and end_iso as YYYY-MM-DDTHH:MM with NO timezone suffix and NO seconds — the server attaches the timezone. Convert natural-language times yourself ('tomorrow at 2pm', 'Friday morning'). Default duration is 30 minutes if the user didn't say otherwise. Attendee_queries are name fragments (e.g. ['Mike', 'jane@texasturfusa.com']) — the runner resolves them against profiles; if any is ambiguous you'll get the candidates and need to ask the user before re-calling.",
    input_schema: {
      type: "object",
      properties: {
        summary:           { type: "string", description: "Event title. Required." },
        start_iso:         { type: "string", description: "YYYY-MM-DDTHH:MM in Central Time, no timezone suffix." },
        end_iso:           { type: "string", description: "YYYY-MM-DDTHH:MM in Central Time, no timezone suffix." },
        description:       { type: "string", description: "Optional event body." },
        location:          { type: "string", description: "Optional location (address, room, link)." },
        attendee_queries:  {
          type:  "array",
          items: { type: "string" },
          description: "Optional list of names or emails to invite. Each resolves to one team member; ambiguous matches return candidates for you to disambiguate.",
        },
      },
      required: ["summary", "start_iso", "end_iso"],
    },
  },
  {
    // Write tool — sends a Slack message. Same draft → confirm card →
    // commit pattern. Recipient can be a channel (#general, channel ID) or
    // a person (name fragment or email; resolved to a Slack user via
    // users.lookupByEmail, then to a DM channel via conversations.open).
    name: "propose_send_slack_message",
    description:
      "Propose a Slack message. The user sees a confirm card before it sends — do NOT tell them it was sent until they confirm. Use recipient to specify either a channel ('#general' or a channel ID starting with 'C') or a person (name fragment like 'Mike', or an email). Person lookups go through profiles → Slack lookup-by-email → DM channel; ambiguous name matches return the candidates for you to disambiguate. Keep the text short and direct — no preamble like 'Hi Mike,'.",
    input_schema: {
      type: "object",
      properties: {
        recipient: {
          type: "string",
          description: "A channel ('#general' or 'C012ABC'), a person's name fragment ('Mike'), or an email ('mike@texasturfusa.com').",
        },
        text: {
          type: "string",
          description: "The message body to send. Plain text; Slack mrkdwn is allowed.",
        },
      },
      required: ["recipient", "text"],
    },
  },
  {
    // Write tool — change a task's status. Title-based lookup against tasks
    // the caller can see (RLS). Same 0/1/ambiguous handling. Doesn't cover
    // archive — that's a separate page action with a role check.
    name: "propose_update_task_status",
    description:
      "Propose a status change for an existing task. Match the task by a fragment of its title (task_query). The user sees a confirm card showing 'old status → new status' before anything changes — do NOT say it's done until they confirm. If multiple tasks match, the tool returns the candidates and you ask the user which one. Doesn't cover archiving — for that, tell the user to use the task page.",
    input_schema: {
      type: "object",
      properties: {
        task_query: {
          type: "string",
          description: "Fragment of the task title to match (case-insensitive). E.g. 'Sage Creek walk'.",
        },
        new_status: {
          type:  "string",
          enum:  [...TASK_STATUS_VALUES],
          description: "Target status: inbox, in_progress, waiting, blocked, or done.",
        },
        blocked_reason: {
          type: "string",
          description: "Optional. Only used when new_status='blocked' — short reason the task is blocked.",
        },
      },
      required: ["task_query", "new_status"],
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
    case "search_tasks":               return searchTasks(input, supabase, userId);
    case "search_invoices":            return searchInvoices(input, supabase);
    case "search_rolls":               return searchRolls(input, supabase);
    case "search_vendors":             return searchVendors(input, supabase);
    case "search_assets":              return searchAssets(input, supabase);
    case "list_upcoming_maintenance":  return listUpcomingMaintenance(input, supabase);
    case "search_projects":            return searchProjects(input, supabase);
    case "search_clients":             return searchClients(input, supabase);
    case "search_meetings":            return searchMeetings(input, supabase);
    case "get_today_schedule":         return getTodaySchedule(supabase, userId);
    case "get_fleet_availability":     return getFleetAvailability(supabase);
    case "pipeline_summary":           return pipelineSummary();
    case "deals_needing_attention":    return dealsNeedingAttention();
    case "search_deals":               return searchDeals(input);
    case "get_dashboard_stats":        return getDashboardStats(supabase, userId);
    case "get_inventory_stats":        return getInventoryStats(supabase);
    case "search_notion_sops":         return searchNotionSops(input);
    case "propose_create_task":             return proposeCreateTask(input, supabase, userId);
    case "propose_schedule_calendar_event": return proposeScheduleCalendarEvent(input, supabase);
    case "propose_send_slack_message":      return proposeSendSlackMessage(input, supabase);
    case "propose_update_task_status":      return proposeUpdateTaskStatus(input, supabase);
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

async function searchAssets(input: ToolInput, supabase: Supabase) {
  let q = supabase
    .from("assets")
    .select("id, name, unit_type, status, ready_status, load_status, next_action, notes, attached_to_id")
    .eq("archived", false)
    .order("name", { ascending: true })
    .limit(20);

  // No status default: return all non-archived assets (matching
  // get_fleet_availability). Only filter when the caller passes a real
  // asset_status value — available / assigned_to_job / in_use_today /
  // maintenance_needed / out_of_service. (There's no "active"/"all" member in
  // the enum, so defaulting to one made Postgres reject every status-less call
  // — e.g. "what trucks do we have?" — and hid the whole fleet.)
  if (typeof input.status === "string") q = q.eq("status", input.status as never);

  if (typeof input.unit_type === "string")    q = q.eq("unit_type", input.unit_type as never);
  if (typeof input.ready_status === "string") q = q.eq("ready_status", input.ready_status as never);

  if (typeof input.query === "string" && input.query.trim()) {
    const term = input.query.trim().replace(/[%_]/g, "");
    q = q.ilike("name", `%${term}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { count: data?.length ?? 0, assets: data ?? [] };
}

async function listUpcomingMaintenance(input: ToolInput, supabase: Supabase) {
  // Default 14-day window; 0 means "overdue only".
  const daysAhead = typeof input.days_ahead === "number" ? input.days_ahead : 14;
  const now    = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("maintenance_schedules")
    .select("id, name, asset_id, interval_type, interval_value, last_serviced_at, next_due_at")
    .eq("active", true)
    .not("next_due_at", "is", null)
    .lte("next_due_at", cutoffIso)
    .order("next_due_at", { ascending: true })
    .limit(40);
  if (error) throw new Error(error.message);

  // Enrich with the asset name so the model doesn't have to call
  // search_assets per row.
  const assetIds = Array.from(new Set((data ?? []).map((r) => r.asset_id)));
  let nameById = new Map<string, string>();
  if (assetIds.length > 0) {
    const { data: names } = await supabase
      .from("assets")
      .select("id, name")
      .in("id", assetIds);
    nameById = new Map((names ?? []).map((a) => [a.id, a.name]));
  }

  const today = now.toISOString().slice(0, 10);
  const enriched = (data ?? []).map((r) => ({
    ...r,
    asset_name: nameById.get(r.asset_id) ?? null,
    overdue:    r.next_due_at != null && r.next_due_at < today,
  }));
  return { count: enriched.length, schedules: enriched, window_days: daysAhead };
}

async function searchProjects(input: ToolInput, supabase: Supabase) {
  let q = supabase
    .from("projects")
    .select("id, name, type, status, priority, customer_name, address, target_install_date, owner_id")
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (typeof input.status === "string") q = q.eq("status", input.status as never);
  if (typeof input.type === "string")   q = q.eq("type", input.type as never);

  if (typeof input.query === "string" && input.query.trim()) {
    const term = input.query.trim().replace(/[%_]/g, "");
    q = q.or(`name.ilike.%${term}%,customer_name.ilike.%${term}%,address.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { count: data?.length ?? 0, projects: data ?? [] };
}

async function searchClients(input: ToolInput, supabase: Supabase) {
  let q = supabase
    .from("jobber_clients")
    .select("id, first_name, last_name, company_name, emails, phones, balance_cents")
    .eq("is_archived", false)
    .order("jobber_updated_at", { ascending: false, nullsFirst: false })
    .limit(20);

  if (typeof input.query === "string" && input.query.trim()) {
    const term = input.query.trim().replace(/[%_]/g, "");
    q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,company_name.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const clients = (data ?? []).map((c) => ({
    id:      c.id,
    name:    [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name || "Unnamed",
    company: c.company_name,
    emails:  c.emails,
    phones:  c.phones,
    balance: typeof c.balance_cents === "number" ? c.balance_cents / 100 : null,
  }));
  return { count: clients.length, clients };
}

async function searchMeetings(input: ToolInput, supabase: Supabase) {
  let q = supabase
    .from("meetings")
    .select("id, name, slug, cadence, day_of_week, day_of_month, scheduled_on, start_time, description")
    .eq("archived", false)
    .order("name", { ascending: true })
    .limit(20);

  if (typeof input.query === "string" && input.query.trim()) {
    const term = input.query.trim().replace(/[%_]/g, "");
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const meetings = (data ?? []).map((m) => ({
    id:              m.id,
    name:            m.name,
    slug:            m.slug,
    cadence:         m.cadence,
    start_time:      m.start_time,
    next_occurrence: upcomingOccurrence(m),
  }));
  return { count: meetings.length, meetings };
}

async function getTodaySchedule(supabase: Supabase, userId: string) {
  // Use the cadence helper's own representation of "today" so meeting
  // occurrence comparison and the visit window agree.
  const todayKey = upcomingOccurrence({ cadence: "daily", day_of_week: null, day_of_month: null });

  const [visitsRes, meetingsRes, myTaskIds] = await Promise.all([
    supabase
      .from("jobber_visits")
      .select("id, title, starts_at, ends_at, is_complete, client_id, job_id")
      .gte("starts_at", `${todayKey}T00:00:00Z`)
      .lte("starts_at", `${todayKey}T23:59:59Z`)
      .order("starts_at", { ascending: true })
      .limit(50),
    supabase
      .from("meetings")
      .select("id, name, slug, cadence, day_of_week, day_of_month, scheduled_on, start_time")
      .eq("archived", false),
    getMyTaskIds(supabase, userId),
  ]);

  const visits = visitsRes.data ?? [];
  const meetingsToday = (meetingsRes.data ?? [])
    .filter((m) => m.cadence !== "adhoc" && upcomingOccurrence(m) === todayKey)
    .map((m) => ({ id: m.id, name: m.name, slug: m.slug, start_time: m.start_time }));

  let tasksDue: Array<{ id: string; title: string; priority: string; status: string }> = [];
  if (myTaskIds.length > 0) {
    const { data: t } = await supabase
      .from("tasks")
      .select("id, title, priority, status")
      .in("id", myTaskIds)
      .not("status", "in", "(done,archived)")
      .eq("due_date", todayKey)
      .limit(50);
    tasksDue = (t ?? []) as typeof tasksDue;
  }

  return {
    date:      todayKey,
    visits:    { count: visits.length, items: visits },
    meetings:  { count: meetingsToday.length, items: meetingsToday },
    tasks_due: { count: tasksDue.length, items: tasksDue },
  };
}

async function getFleetAvailability(supabase: Supabase) {
  const nowIso = new Date().toISOString();

  const [assetsRes, resRes] = await Promise.all([
    supabase
      .from("assets")
      .select("id, name, identifier, unit_type, status, ready_status")
      .eq("archived", false)
      .order("name", { ascending: true })
      .limit(50),
    supabase
      .from("vehicle_reservations")
      .select("asset_id, starts_at, ends_at, purpose, destination")
      .eq("status", "active")
      .gte("ends_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(200),
  ]);

  const reservations = resRes.data ?? [];
  type Res = (typeof reservations)[number];
  const nowMs = Date.now();
  const currentByAsset = new Map<string, Res>();
  const upcomingByAsset = new Map<string, Res[]>();
  for (const r of reservations) {
    // Parse to epoch so Postgres "+00:00" vs JS "Z" formatting can't skew the
    // comparison (lexicographic string compare would be unreliable here).
    const startMs = new Date(r.starts_at).getTime();
    const endMs = new Date(r.ends_at).getTime();
    if (startMs <= nowMs && endMs >= nowMs) {
      if (!currentByAsset.has(r.asset_id)) currentByAsset.set(r.asset_id, r);
    } else if (startMs > nowMs) {
      const arr = upcomingByAsset.get(r.asset_id) ?? [];
      arr.push(r);
      upcomingByAsset.set(r.asset_id, arr);
    }
  }

  const assets = (assetsRes.data ?? []).map((a) => {
    const current = currentByAsset.get(a.id) ?? null;
    return {
      id:            a.id,
      name:          a.name,
      identifier:    a.identifier,
      unit_type:     a.unit_type,
      status:        a.status,
      ready_status:  a.ready_status,
      available_now: !current,
      current_reservation: current
        ? { until: current.ends_at, purpose: current.purpose, destination: current.destination }
        : null,
      upcoming_reservations: (upcomingByAsset.get(a.id) ?? [])
        .slice(0, 3)
        .map((r) => ({ from: r.starts_at, to: r.ends_at, purpose: r.purpose })),
    };
  });

  return { now: nowIso, count: assets.length, assets };
}

// ─── Sales pipeline (read-only; RLS via the sales query layer) ───────────────

/**
 * Pipeline rollups for Turfy: open value, weighted value, win rate (90d), and
 * value closing this month. Money is pre-formatted with usd() so the model
 * doesn't have to; raw numbers ride alongside for any follow-up math.
 */
async function pipelineSummary() {
  const deals = await getAllDeals();
  const now = today();
  const open = openPipelineValue(deals);
  const weighted = weightedPipeline(deals);
  const closing = closingThisMonth(deals, now);
  const rate = winRate(deals, 90, now);
  return {
    open_pipeline:      usd(open),
    weighted_pipeline:  usd(weighted),
    win_rate_90d:       `${Math.round(rate * 100)}%`,
    closing_this_month: usd(closing),
    open_deal_count:    deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost").length,
  };
}

/**
 * Open deals carrying risk flags. To assess "gone quiet" accurately we fetch a
 * last-activity timestamp per deal (getLastActivityMap) and synthesize a single
 * activity carrying that occurred_at — passing [] would make assessDeal report
 * "No activity logged" for every deal, since it can't tell a quiet deal from
 * one whose activity simply wasn't loaded. Returns amber/red deals only.
 */
async function dealsNeedingAttention() {
  const deals = await getOpenDeals();
  const now = today();
  const lastActivity = await getLastActivityMap(deals.map((d) => d.id));

  const flagged = deals
    .map((deal) => {
      const lastAt = lastActivity[deal.id];
      // Synthesize one stand-in activity per deal so assessDeal's gone-quiet
      // rule reads a real last-touch date. Deals with no logged activity get
      // an empty list → correctly flagged "No activity logged".
      const activities: DealActivity[] = lastAt
        ? [{
            id: `last-${deal.id}`,
            deal_id: deal.id,
            kind: "note",
            body: null,
            direction: null,
            metadata: {},
            occurred_at: lastAt,
            created_by: null,
          }]
        : [];
      const { flags, health } = assessDeal(deal, activities, now);
      return { deal, flags, health };
    })
    .filter((d) => d.health !== "green")
    // Red (2+ flags) before amber, then by deal value.
    .sort((a, b) =>
      a.health === b.health
        ? (b.deal.value_usd ?? 0) - (a.deal.value_usd ?? 0)
        : a.health === "red" ? -1 : 1,
    )
    .slice(0, 15);

  return {
    count: flagged.length,
    deals: flagged.map(({ deal, flags, health }) => ({
      id:     deal.id,
      name:   deal.name,
      stage:  STAGE_LABELS[deal.stage],
      value:  usd(deal.value_usd),
      health,
      flags:  flags.map((f) => f.label),
    })),
  };
}

/**
 * Search open deals by name (case-insensitive contains), optionally filtered by
 * stage. Filtering is done in JS over the open-deals set so the tool stays a
 * single query and respects the same RLS path as the rest of the sales reads.
 */
async function searchDeals(input: ToolInput) {
  const deals = await getOpenDeals();
  const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
  const stage = typeof input.stage === "string" ? (input.stage as Stage) : null;

  const matches = deals
    .filter((d) => (stage ? d.stage === stage : true))
    .filter((d) => (query ? d.name.toLowerCase().includes(query) : true))
    .slice(0, 20);

  return {
    count: matches.length,
    deals: matches.map((d) => ({
      id:        d.id,
      name:      d.name,
      stage:     STAGE_LABELS[d.stage],
      value:     usd(d.value_usd),
      next_step: d.next_step,
    })),
  };
}

// ─── Write tools (propose_* — return drafts, never mutate) ──────────────────

/**
 * Propose a new task. Resolves the assignee_query against profiles (ILIKE
 * full_name + email), builds a DraftTask, returns a ProposeResult envelope.
 * Nothing is written here — the user confirms via the UI, then the
 * commit-draft endpoint calls the real createTask server action.
 */
async function proposeCreateTask(
  input: ToolInput,
  supabase: Supabase,
  userId: string,
): Promise<ProposeResult> {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    return { kind: "error", error: "Task title is required." };
  }

  // ── Resolve assignee_query → profile_id ──
  const rawQuery = typeof input.assignee_query === "string" ? input.assignee_query.trim() : "";
  let assigneeId: string | null = null;
  let assigneeDisplay: string | null = null;

  if (rawQuery) {
    const term = rawQuery.replace(/[%_]/g, "");
    const { data: candidates, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(5);
    if (error) {
      return { kind: "error", error: `Couldn't look up assignee: ${error.message}` };
    }
    const matches = candidates ?? [];
    if (matches.length === 0) {
      return {
        kind: "error",
        error: `No team member matches "${rawQuery}". Try a different name, or omit assignee to assign to the caller.`,
      };
    }
    if (matches.length > 1) {
      return {
        kind: "ambiguous",
        reason: `"${rawQuery}" matches ${matches.length} people. Ask the user which one.`,
        candidates: matches.map((m) => ({
          id:      m.id,
          display: m.full_name ?? m.email,
        })),
      };
    }
    assigneeId      = matches[0].id;
    assigneeDisplay = matches[0].full_name ?? matches[0].email;
  } else {
    // Default to caller — resolve their display name for the confirm card.
    const { data: me } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();
    assigneeId      = userId;
    assigneeDisplay = me?.full_name ?? me?.email ?? "you";
  }

  // ── Validate the draft shape ──
  const draftCandidate = {
    kind: "task" as const,
    title,
    description: typeof input.description === "string" && input.description.trim()
      ? input.description.trim()
      : undefined,
    priority: typeof input.priority === "string"
      ? (input.priority as DraftTask["priority"])
      : "normal" as const,
    due_date: typeof input.due_date === "string" && input.due_date.trim()
      ? input.due_date.trim()
      : undefined,
    assignee_id: assigneeId,
    assignee_display: assigneeDisplay,
  };

  const parsed = DraftTaskSchema.safeParse(draftCandidate);
  if (!parsed.success) {
    return {
      kind: "error",
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  const draft = parsed.data;
  return {
    kind: "draft",
    draft_id: crypto.randomUUID(),
    draft,
    summary: summarizeDraft(draft),
  };
}

/**
 * Propose a Google Calendar event. Resolves each attendee_query against
 * profiles (or accepts an email as-is). Returns ambiguous on multi-match,
 * error on no-match. Nothing is written here — the user confirms via the
 * UI, then the commit-draft endpoint calls Google Calendar.
 */
async function proposeScheduleCalendarEvent(
  input: ToolInput,
  supabase: Supabase,
): Promise<ProposeResult> {
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  if (!summary) {
    return { kind: "error", error: "Event title is required." };
  }

  // ── Resolve attendees ──
  const rawQueries = Array.isArray(input.attendee_queries)
    ? input.attendee_queries.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];

  const resolvedAttendees: DraftAttendee[] = [];
  for (const rawQ of rawQueries) {
    const q = rawQ.trim();
    // Email-shaped → trust the model (RLS doesn't apply to Google Calendar
    // invites, and the user is explicitly choosing to invite this address).
    if (q.includes("@")) {
      resolvedAttendees.push({ email: q, display: null });
      continue;
    }

    const term = q.replace(/[%_]/g, "");
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(5);
    if (error) {
      return { kind: "error", error: `Couldn't look up attendee "${q}": ${error.message}` };
    }
    const matches = data ?? [];
    if (matches.length === 0) {
      return {
        kind: "error",
        error: `No team member matches "${q}". Try a different name, an email address, or remove that attendee.`,
      };
    }
    if (matches.length > 1) {
      return {
        kind: "ambiguous",
        reason: `"${q}" matches ${matches.length} people. Ask the user which one.`,
        candidates: matches.map((m) => ({
          id:      m.email,                  // commit endpoint uses email, not profile id
          display: `${m.full_name ?? m.email} <${m.email}>`,
        })),
      };
    }
    resolvedAttendees.push({
      email:   matches[0].email,
      display: matches[0].full_name ?? matches[0].email,
    });
  }

  // ── Build + validate the draft ──
  const draftCandidate = {
    kind:        "calendar_event" as const,
    summary,
    start_iso:   typeof input.start_iso === "string" ? input.start_iso.trim() : "",
    end_iso:     typeof input.end_iso   === "string" ? input.end_iso.trim()   : "",
    description: typeof input.description === "string" && input.description.trim()
      ? input.description.trim() : undefined,
    location:    typeof input.location === "string" && input.location.trim()
      ? input.location.trim() : undefined,
    attendees:   resolvedAttendees,
  };

  const parsed = DraftCalendarEventSchema.safeParse(draftCandidate);
  if (!parsed.success) {
    return {
      kind: "error",
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  // Light sanity check: end must be after start. Zod doesn't model this
  // cross-field, so do it here.
  if (parsed.data.end_iso <= parsed.data.start_iso) {
    return {
      kind: "error",
      error: "Event end must be after start. Did you mean a later time?",
    };
  }

  const draft = parsed.data;
  return {
    kind: "draft",
    draft_id: crypto.randomUUID(),
    draft,
    summary: summarizeDraft(draft),
  };
}

/**
 * Propose a Slack message. Resolves the recipient at propose time so the
 * commit step is a single chat.postMessage call. Channel references go
 * through as-is; person references go through profiles → email →
 * Slack.lookupUserByEmail → openDM to get the DM channel ID.
 *
 * The resolved channel ID (or channel name) is stored in the draft so the
 * commit endpoint doesn't have to re-resolve.
 */
async function proposeSendSlackMessage(
  input: ToolInput,
  supabase: Supabase,
): Promise<ProposeResult> {
  const recipientRaw = typeof input.recipient === "string" ? input.recipient.trim() : "";
  const text         = typeof input.text === "string" ? input.text.trim() : "";
  if (!recipientRaw) return { kind: "error", error: "Recipient is required." };
  if (!text)         return { kind: "error", error: "Message text is required." };

  let channel:           string;
  let recipientDisplay:  string;
  let recipientKind:     "channel" | "dm";

  // Channel reference? Use as-is.
  if (recipientRaw.startsWith("#") || /^C[A-Z0-9]{4,}$/i.test(recipientRaw)) {
    channel          = recipientRaw;
    recipientDisplay = recipientRaw;
    recipientKind    = "channel";
  } else {
    // Person reference. If email-shaped, look up directly; otherwise resolve
    // a profile first, then look up its email in Slack.
    let email: string;
    let display: string;

    if (recipientRaw.includes("@")) {
      email   = recipientRaw;
      display = recipientRaw;
    } else {
      const term = recipientRaw.replace(/[%_]/g, "");
      const { data: matches, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(5);
      if (error) return { kind: "error", error: `Couldn't look up "${recipientRaw}": ${error.message}` };
      const list = matches ?? [];
      if (list.length === 0) {
        return {
          kind: "error",
          error: `No team member matches "${recipientRaw}". Try a different name, or use #channel for a channel.`,
        };
      }
      if (list.length > 1) {
        return {
          kind: "ambiguous",
          reason: `"${recipientRaw}" matches ${list.length} people. Ask the user which one.`,
          candidates: list.map((m) => ({
            id:      m.email,
            display: `${m.full_name ?? m.email} <${m.email}>`,
          })),
        };
      }
      email   = list[0].email;
      display = list[0].full_name ?? list[0].email;
    }

    // Resolve email → Slack user ID → DM channel ID.
    const lookup = await lookupUserByEmail(email);
    if (!lookup.ok) {
      const helpful: Record<typeof lookup.code, string> = {
        not_configured: "Slack isn't configured (SLACK_BOT_TOKEN missing).",
        missing_scope:  `Slack bot lacks the 'users:read.email' scope${lookup.detail ? ` (${lookup.detail})` : ""}. Ask the admin to add it.`,
        not_found:      `Slack couldn't find a user with the email ${email}. Are they in the workspace?`,
        api_error:      `Slack lookup failed: ${lookup.detail ?? "unknown"}`,
        fetch_failed:   `Couldn't reach Slack: ${lookup.detail ?? "network error"}`,
      };
      return { kind: "error", error: helpful[lookup.code] };
    }

    const dm = await openDM(lookup.user.id);
    if (!dm.ok) {
      const helpful: Record<typeof dm.code, string> = {
        not_configured: "Slack isn't configured (SLACK_BOT_TOKEN missing).",
        missing_scope:  `Slack bot lacks the 'im:write' scope${dm.detail ? ` (${dm.detail})` : ""}. Ask the admin to add it.`,
        not_found:      `Slack couldn't open a DM channel for that user.`,
        api_error:      `Slack openDM failed: ${dm.detail ?? "unknown"}`,
        fetch_failed:   `Couldn't reach Slack: ${dm.detail ?? "network error"}`,
      };
      return { kind: "error", error: helpful[dm.code] };
    }

    channel          = dm.channel.id;
    recipientDisplay = display;
    recipientKind    = "dm";
  }

  const parsed = DraftSlackMessageSchema.safeParse({
    kind: "slack_message",
    channel,
    recipient_display: recipientDisplay,
    recipient_kind:    recipientKind,
    text,
  });
  if (!parsed.success) {
    return {
      kind: "error",
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  const draft = parsed.data;
  return {
    kind: "draft",
    draft_id: crypto.randomUUID(),
    draft,
    summary: summarizeDraft(draft),
  };
}

/**
 * Propose a status change for a task identified by a title fragment.
 * Uses the user-context supabase client so RLS limits the search to tasks
 * the caller is already allowed to see.
 */
async function proposeUpdateTaskStatus(
  input: ToolInput,
  supabase: Supabase,
): Promise<ProposeResult> {
  const query     = typeof input.task_query === "string" ? input.task_query.trim() : "";
  const newStatus = typeof input.new_status === "string" ? input.new_status.trim() : "";
  if (!query)     return { kind: "error", error: "task_query is required." };
  if (!newStatus) return { kind: "error", error: "new_status is required." };
  if (!(TASK_STATUS_VALUES as readonly string[]).includes(newStatus)) {
    return { kind: "error", error: `new_status must be one of: ${TASK_STATUS_VALUES.join(", ")}.` };
  }

  const blockedReason = typeof input.blocked_reason === "string" && input.blocked_reason.trim()
    ? input.blocked_reason.trim()
    : undefined;

  const term = query.replace(/[%_]/g, "");
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status")
    .neq("status", "archived")
    .ilike("title", `%${term}%`)
    .order("updated_at", { ascending: false })
    .limit(6);
  if (error) {
    return { kind: "error", error: `Couldn't search tasks: ${error.message}` };
  }

  const matches = data ?? [];
  if (matches.length === 0) {
    return {
      kind: "error",
      error: `No task matches "${query}". Try a different fragment of the title.`,
    };
  }
  if (matches.length > 1) {
    return {
      kind: "ambiguous",
      reason: `"${query}" matches ${matches.length} tasks. Ask the user which one.`,
      candidates: matches.slice(0, 5).map((m) => ({
        id:      m.id,
        display: `${m.title} (${m.status})`,
      })),
    };
  }

  const task = matches[0];

  // Guard against no-op proposals — surface as a friendly error so Turfy
  // tells the user the task is already in that state instead of showing a
  // confirm card for a non-change.
  if (task.status === newStatus) {
    return {
      kind: "error",
      error: `"${task.title}" is already ${newStatus}. Nothing to change.`,
    };
  }

  const parsed = DraftUpdateTaskStatusSchema.safeParse({
    kind:           "update_task_status",
    task_id:        task.id,
    task_title:     task.title,
    current_status: task.status,
    new_status:     newStatus,
    blocked_reason: blockedReason,
  });
  if (!parsed.success) {
    return {
      kind: "error",
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  const draft = parsed.data;
  return {
    kind: "draft",
    draft_id: crypto.randomUUID(),
    draft,
    summary: summarizeDraft(draft),
  };
}

async function getInventoryStats(supabase: Supabase) {
  // inv_items low-stock is computed in JS because there is no view yet;
  // cap at 500 items so a future large catalog doesn't OOM the assistant
  // route. (Roadmap: turn this into a postgres count.)
  const [openRolls, activeJobs, pendingReceive, lowStock] = await Promise.all([
    supabase.from("inv_rolls").select("id", { count: "exact", head: true })
      .in("status", ["available","planned"]),
    supabase.from("inv_jobs").select("id", { count: "exact", head: true })
      .in("status", ["in_progress","staged"]),
    supabase.from("inv_rolls").select("id", { count: "exact", head: true })
      .eq("status", "planned"),
    supabase.from("inv_items")
      .select("id, quantity, min_quantity")
      .eq("active", true)
      .limit(500),
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
