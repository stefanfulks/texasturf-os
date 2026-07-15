import { createClient } from "@/lib/supabase/server";
import type { CallAiReview, CallRow } from "@/lib/db-helpers.types";

// Coaching + BDR-today reads (calling suite Phase 4). User-context client so
// RLS applies (AGENTS.md §6). All aggregation happens in code over recent
// windows — call volume is human-paced, hundreds of rows, not millions.

export type RepStat = {
  repId: string;
  repName: string;
  calls: number;
  connected: number;
  avgInterest: number | null;
  avgDurationSec: number | null;
  followUpTasks: number;
};

export type ObjectionTheme = {
  theme: string;
  count: number;
  quotes: string[];
};

export type CoachingData = {
  repStats: RepStat[];
  objectionThemes: ObjectionTheme[];
  recentCalls: (CallRow & { review: CallAiReview | null; callerName: string | null })[];
};

const COACHING_WINDOW_DAYS = 30;

export async function getCoachingData(): Promise<CoachingData> {
  const sb = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - COACHING_WINDOW_DAYS);
  const sinceIso = since.toISOString();

  const { data: callsData } = await sb
    .from("calls")
    .select("*")
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false })
    .limit(500);
  const calls = (callsData ?? []) as CallRow[];

  const callIds = calls.map((c) => c.id);
  const callerIds = [...new Set(calls.map((c) => c.caller_id))];

  const [{ data: reviewsData }, { data: profilesData }] = await Promise.all([
    callIds.length
      ? sb.from("call_ai_reviews").select("*").in("call_id", callIds)
      : Promise.resolve({ data: [] }),
    callerIds.length
      ? sb.from("profiles").select("id, full_name").in("id", callerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const reviews = (reviewsData ?? []) as CallAiReview[];
  const reviewByCall = new Map(reviews.map((r) => [r.call_id, r]));
  const nameById = new Map(
    ((profilesData ?? []) as { id: string; full_name: string | null }[]).map((p) => [
      p.id,
      p.full_name ?? "Unknown",
    ]),
  );

  // Per-rep talk-track stats.
  const byRep = new Map<string, { calls: CallRow[]; reviews: CallAiReview[] }>();
  for (const c of calls) {
    const bucket = byRep.get(c.caller_id) ?? { calls: [], reviews: [] };
    bucket.calls.push(c);
    const r = reviewByCall.get(c.id);
    if (r) bucket.reviews.push(r);
    byRep.set(c.caller_id, bucket);
  }
  const repStats: RepStat[] = [...byRep.entries()]
    .map(([repId, b]) => {
      const durations = b.calls.map((c) => c.duration_sec ?? 0).filter((d) => d > 0);
      const interests = b.reviews.map((r) => r.interest_level);
      const connected = b.reviews.filter((r) =>
        r.outcome_class.startsWith("connected"),
      ).length;
      const followUpTasks = b.reviews.reduce(
        (n, r) => n + (Array.isArray(r.follow_ups) ? r.follow_ups.length : 0),
        0,
      );
      return {
        repId,
        repName: nameById.get(repId) ?? "Unknown",
        calls: b.calls.length,
        connected,
        avgInterest: interests.length
          ? Math.round((interests.reduce((a, v) => a + v, 0) / interests.length) * 10) / 10
          : null,
        avgDurationSec: durations.length
          ? Math.round(durations.reduce((a, v) => a + v, 0) / durations.length)
          : null,
        followUpTasks,
      };
    })
    .sort((a, b) => b.calls - a.calls);

  // Objection themes: group by normalized objection text across all reviews.
  const themeMap = new Map<string, ObjectionTheme>();
  for (const r of reviews) {
    const objections = (r.objections ?? []) as { objection?: string; quote?: string }[];
    if (!Array.isArray(objections)) continue;
    for (const o of objections) {
      if (!o?.objection) continue;
      const key = o.objection.trim().toLowerCase();
      const theme = themeMap.get(key) ?? { theme: o.objection.trim(), count: 0, quotes: [] };
      theme.count += 1;
      if (o.quote && theme.quotes.length < 3) theme.quotes.push(o.quote);
      themeMap.set(key, theme);
    }
  }
  const objectionThemes = [...themeMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentCalls = calls.slice(0, 25).map((c) => ({
    ...c,
    review: reviewByCall.get(c.id) ?? null,
    callerName: nameById.get(c.caller_id) ?? null,
  }));

  return { repStats, objectionThemes, recentCalls };
}

// ── BDR "Today" queue ────────────────────────────────────────────────────────

export type TodayData = {
  myLists: { id: string; name: string; brand: string; pending: number; total: number }[];
  dueTasks: { id: string; title: string; due_date: string | null; priority: string; status: string }[];
  callbacks: {
    attemptId: string;
    callbackAt: string;
    targetName: string | null;
    targetPhone: string | null;
    listId: string | null;
  }[];
};

export async function getTodayData(userId: string): Promise<TodayData> {
  const sb = await createClient();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [listsRes, tasksRes, callbacksRes] = await Promise.all([
    sb
      .from("call_lists")
      .select("id, name, brand")
      .eq("status", "active")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    // Call-generated tasks assigned to me, not done, due (or undated inbox).
    sb
      .from("tasks")
      .select("id, title, due_date, priority, status")
      .eq("assignee_id", userId)
      .contains("tags", ["call-followup"])
      .not("status", "in", '("done")')
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50),
    sb
      .from("call_attempts")
      .select("id, callback_at, call_list_id, call_list_item_id")
      .eq("rep_id", userId)
      .eq("outcome", "callback_scheduled")
      .not("callback_at", "is", null)
      .lte("callback_at", endOfDay.toISOString())
      .order("callback_at", { ascending: true })
      .limit(25),
  ]);

  const lists = (listsRes.data ?? []) as { id: string; name: string; brand: string }[];
  let myLists: TodayData["myLists"] = [];
  if (lists.length) {
    const { data: items } = await sb
      .from("call_list_items")
      .select("call_list_id, status")
      .in("call_list_id", lists.map((l) => l.id));
    const counts = new Map<string, { pending: number; total: number }>();
    for (const it of (items ?? []) as { call_list_id: string; status: string }[]) {
      const c = counts.get(it.call_list_id) ?? { pending: 0, total: 0 };
      c.total += 1;
      if (it.status === "pending") c.pending += 1;
      counts.set(it.call_list_id, c);
    }
    myLists = lists.map((l) => ({
      ...l,
      pending: counts.get(l.id)?.pending ?? 0,
      total: counts.get(l.id)?.total ?? 0,
    }));
  }

  // Resolve callback names via their list items.
  const cbRows = (callbacksRes.data ?? []) as {
    id: string;
    callback_at: string;
    call_list_id: string | null;
    call_list_item_id: string | null;
  }[];
  const itemIds = cbRows.map((c) => c.call_list_item_id).filter((v): v is string => !!v);
  const itemById = new Map<string, { snapshot_name: string | null; snapshot_phone: string | null }>();
  if (itemIds.length) {
    const { data: cbItems } = await sb
      .from("call_list_items")
      .select("id, snapshot_name, snapshot_phone")
      .in("id", itemIds);
    for (const it of (cbItems ?? []) as {
      id: string;
      snapshot_name: string | null;
      snapshot_phone: string | null;
    }[]) {
      itemById.set(it.id, it);
    }
  }
  const callbacks = cbRows.map((c) => ({
    attemptId: c.id,
    callbackAt: c.callback_at,
    targetName: c.call_list_item_id
      ? itemById.get(c.call_list_item_id)?.snapshot_name ?? null
      : null,
    targetPhone: c.call_list_item_id
      ? itemById.get(c.call_list_item_id)?.snapshot_phone ?? null
      : null,
    listId: c.call_list_id,
  }));

  return {
    myLists,
    dueTasks: (tasksRes.data ?? []) as TodayData["dueTasks"],
    callbacks,
  };
}
