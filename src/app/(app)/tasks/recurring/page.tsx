import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecurringRuleForm } from "./rule-form";
import { RuleRow } from "./rule-row";
import type { RecurringRule, Profile, Project } from "@/lib/db-helpers.types";

export default async function RecurringTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [rulesRes, profilesRes, projectsRes] = await Promise.all([
    supabase
      .from("recurring_rules")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .order("full_name"),
    supabase
      .from("projects")
      .select("id, name, status")
      .not("status", "in", '("complete","cancelled","on_hold")')
      .order("name"),
  ]);

  const rules = (rulesRes.data ?? []) as RecurringRule[];
  const profiles = (profilesRes.data ?? []) as Profile[];
  const projects = (projectsRes.data ?? []) as Project[];

  // Build a quick lookup for assignee names
  const profilesMap = new Map(
    profiles.map((p) => [p.id, p.full_name ?? p.email.split("@")[0]])
  );

  const activeRules  = rules.filter((r) => r.active);
  const pausedRules  = rules.filter((r) => !r.active);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">← Tasks</Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recurring Tasks</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Rules that automatically create tasks on a schedule</p>
        </div>
        <RecurringRuleForm profiles={profiles} projects={projects} currentUserId={user.id} />
      </div>

      {/* Active rules */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
          <span className="text-xs font-semibold text-zinc-600">Active</span>
          <span className="ml-2 text-xs text-zinc-400">{activeRules.length}</span>
        </div>
        {activeRules.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">
            No active recurring rules. Create one above.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {activeRules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                assigneeName={profilesMap.get(rule.assignee_id) ?? rule.assignee_id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Paused rules */}
      {pausedRules.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
            <span className="text-xs font-semibold text-zinc-600">Paused</span>
            <span className="ml-2 text-xs text-zinc-400">{pausedRules.length}</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {pausedRules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                assigneeName={profilesMap.get(rule.assignee_id) ?? rule.assignee_id}
              />
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">How it works</h3>
        <ul className="space-y-1.5 text-sm text-zinc-600 list-disc list-inside">
          <li>Each active rule generates a task automatically when its <strong>next due date</strong> arrives</li>
          <li><strong>Lead days</strong> creates the task N days before the due date (e.g. 1 = a day early)</li>
          <li>Pausing a rule stops new tasks from being created but keeps existing ones</li>
          <li>Tasks generated from a rule are linked — you can see them in the task board filtered by project</li>
        </ul>
        <p className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-100">
          Generation runs daily via <code className="bg-zinc-100 px-1 rounded">/api/cron/recurring</code>
        </p>
      </div>
    </div>
  );
}
