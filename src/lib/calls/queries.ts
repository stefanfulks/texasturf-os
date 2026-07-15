import { createClient } from "@/lib/supabase/server";
import type { CallRow, CallAiReview } from "@/lib/db-helpers.types";

// Reads use the user-context SSR client so RLS applies (AGENTS.md §6).

export type CallWithReview = CallRow & {
  review: CallAiReview | null;
  callerName: string | null;
};

export async function getRecentCalls(filters: {
  brand?: "texasturf" | "turfcasa";
  limit?: number;
}): Promise<CallWithReview[]> {
  const sb = await createClient();
  let q = sb
    .from("calls")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.brand) q = q.eq("brand", filters.brand);
  const { data } = await q;
  const calls = (data ?? []) as CallRow[];
  if (!calls.length) return [];

  const callIds = calls.map((c) => c.id);
  const callerIds = [...new Set(calls.map((c) => c.caller_id))];
  const [{ data: reviews }, { data: callers }] = await Promise.all([
    sb.from("call_ai_reviews").select("*").in("call_id", callIds),
    sb.from("profiles").select("id, full_name").in("id", callerIds),
  ]);

  const reviewByCall = new Map(
    ((reviews ?? []) as CallAiReview[]).map((r) => [r.call_id, r]),
  );
  const nameById = new Map(
    ((callers ?? []) as { id: string; full_name: string | null }[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  return calls.map((c) => ({
    ...c,
    review: reviewByCall.get(c.id) ?? null,
    callerName: nameById.get(c.caller_id) ?? null,
  }));
}

export type CallDetail = {
  call: CallRow;
  review: CallAiReview | null;
  callerName: string | null;
  tasks: { id: string; title: string; status: string; due_date: string | null }[];
};

export async function getCallDetail(id: string): Promise<CallDetail | null> {
  const sb = await createClient();
  const { data } = await sb.from("calls").select("*").eq("id", id).maybeSingle();
  const call = data as CallRow | null;
  if (!call) return null;

  const [{ data: review }, { data: caller }, { data: tasks }] = await Promise.all([
    sb.from("call_ai_reviews").select("*").eq("call_id", id).maybeSingle(),
    sb.from("profiles").select("full_name").eq("id", call.caller_id).maybeSingle(),
    // Call-generated tasks carry a `call:<id>` tag (see lib/calls/pipeline.ts).
    sb
      .from("tasks")
      .select("id, title, status, due_date")
      .contains("tags", [`call:${id}`])
      .order("due_date", { ascending: true }),
  ]);

  return {
    call,
    review: (review ?? null) as CallAiReview | null,
    callerName: (caller as { full_name: string | null } | null)?.full_name ?? null,
    tasks: (tasks ?? []) as CallDetail["tasks"],
  };
}
