/**
 * In-app notifications for Jobber webhook events.
 *
 * Fans a single event out to every admin + office profile so the bell (and
 * its realtime subscription) surfaces Jobber activity the moment the webhook
 * lands. Best-effort by design: a notification failure must never fail the
 * sync that triggered it, so errors go to Sentry and are swallowed.
 */

import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabase/admin";

const NOTIFIED_ROLES = ["admin", "office"];

export async function notifyTeam(input: {
  type: string;
  title: string;
  body?: string | null;
  resourceType: string;
  resourceRef?: string | null;
}) {
  try {
    const supa = supabaseAdmin();
    const { data: profiles, error: profileErr } = await supa
      .from("profiles")
      .select("id")
      .in("role", NOTIFIED_ROLES);
    if (profileErr) throw new Error(profileErr.message);
    if (!profiles || profiles.length === 0) return;

    const { error } = await supa.from("notifications").insert(
      profiles.map((p) => ({
        user_id: p.id,
        actor_id: null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        resource_type: input.resourceType,
        resource_id: null,
        resource_ref: input.resourceRef ?? null,
      })),
    );
    if (error) throw new Error(error.message);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: "jobber", area: "notify" },
      extra: { type: input.type },
    });
  }
}

export function clientDisplayName(c: {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}): string {
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ");
  return person || c.company_name || "Unnamed client";
}
