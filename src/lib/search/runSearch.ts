"use server";

/**
 * Universal search across the app's primary entities.
 *
 * Returns categorized hits (deals, contacts, clients, jobs, projects, tasks,
 * invoices, vendors, vehicles, meetings, team members). Each query runs under
 * the signed-in user's RLS — searchers only see what they're already allowed
 * to see (AGENTS.md §6). One unreachable table never breaks the rest:
 * Promise.allSettled keeps every other category visible.
 *
 * Pages are NOT searched here — the client palette filters its own static
 * route list, so navigation works instantly without a round trip.
 */

import { createClient } from "@/lib/supabase/server";

export type SearchType =
  | "deal"
  | "contact"
  | "client"
  | "job"
  | "project"
  | "task"
  | "invoice"
  | "vendor"
  | "vehicle"
  | "meeting"
  | "person";

export interface SearchHit {
  id: string;
  type: SearchType;
  label: string;
  sublabel?: string;
  href: string;
}

export interface SearchGroup {
  type: SearchType;
  label: string;
  hits: SearchHit[];
}

export interface SearchResults {
  query: string;
  groups: SearchGroup[];
}

const PER_TYPE_LIMIT = 6;

/** Escape PostgREST ilike metacharacters so user input can't broaden the match. */
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function runSearch(rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim();
  if (query.length < 2) return { query, groups: [] };

  const pattern = `%${escapeIlike(query)}%`;
  const orPattern = `%${escapeIlike(query)}%`;
  const sb = await createClient();

  // Each query runs independently — Promise.allSettled keeps a broken
  // category from hiding everything else.
  const sources: Array<{
    type: SearchType;
    label: string;
    run: () => Promise<SearchHit[]>;
  }> = [
    {
      type: "deal",
      label: "Sales deals",
      run: async () => {
        const { data } = await sb
          .from("deals")
          .select("id, name, stage, value_usd")
          .ilike("name", pattern)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((d) => ({
          id: `deal-${d.id}`,
          type: "deal" as const,
          label: d.name,
          sublabel: [stageLabel(d.stage), money(d.value_usd)]
            .filter(Boolean)
            .join(" · "),
          href: `/sales/deals/${d.id}`,
        }));
      },
    },
    {
      type: "contact",
      label: "Sales contacts",
      run: async () => {
        const { data } = await sb
          .from("sales_contacts")
          .select("id, name, company, city")
          .or(`name.ilike.${orPattern},company.ilike.${orPattern}`)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((c) => ({
          id: `contact-${c.id}`,
          type: "contact" as const,
          label: c.name,
          sublabel: [c.company, c.city].filter(Boolean).join(" · "),
          href: `/sales`,
        }));
      },
    },
    {
      type: "client",
      label: "Clients",
      run: async () => {
        const { data } = await sb
          .from("jobber_clients")
          .select("id, company_name, first_name, last_name")
          .or(
            `company_name.ilike.${orPattern},first_name.ilike.${orPattern},last_name.ilike.${orPattern}`,
          )
          .eq("is_archived", false)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((c) => {
          const personName = [c.first_name, c.last_name].filter(Boolean).join(" ");
          const label = c.company_name || personName || "Unnamed client";
          const sublabel =
            c.company_name && personName ? personName : undefined;
          return {
            id: `client-${c.id}`,
            type: "client" as const,
            label,
            sublabel,
            href: `/clients/${c.id}`,
          };
        });
      },
    },
    {
      type: "job",
      label: "Jobs (Jobber)",
      run: async () => {
        const { data } = await sb
          .from("jobber_jobs")
          .select("id, title, job_number, status")
          .or(`title.ilike.${orPattern},job_number.ilike.${orPattern}`)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((j) => ({
          id: `job-${j.id}`,
          type: "job" as const,
          label: j.title ?? `Job ${j.job_number ?? j.id}`,
          sublabel: [j.job_number, j.status].filter(Boolean).join(" · "),
          href: `/jobs`,
        }));
      },
    },
    {
      type: "project",
      label: "Projects",
      run: async () => {
        const { data } = await sb
          .from("projects")
          .select("id, name")
          .ilike("name", pattern)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((p) => ({
          id: `project-${p.id}`,
          type: "project" as const,
          label: p.name,
          href: `/jobs/${p.id}`,
        }));
      },
    },
    {
      type: "task",
      label: "Tasks",
      run: async () => {
        const { data } = await sb
          .from("tasks")
          .select("id, title, completed_at, due_date")
          .ilike("title", pattern)
          .order("created_at", { ascending: false })
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((t) => ({
          id: `task-${t.id}`,
          type: "task" as const,
          label: t.title,
          sublabel: t.completed_at
            ? "Completed"
            : t.due_date
              ? `Due ${t.due_date}`
              : undefined,
          href: `/tasks/${t.id}`,
        }));
      },
    },
    {
      type: "invoice",
      label: "Invoices",
      run: async () => {
        const { data } = await sb
          .from("invoices")
          .select("id, title, invoice_number, status")
          .or(`title.ilike.${orPattern},invoice_number.ilike.${orPattern}`)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((i) => ({
          id: `invoice-${i.id}`,
          type: "invoice" as const,
          label: i.title || `Invoice ${i.invoice_number ?? ""}`.trim(),
          sublabel: [i.invoice_number, i.status].filter(Boolean).join(" · "),
          href: `/invoices/${i.id}`,
        }));
      },
    },
    {
      type: "vendor",
      label: "Vendors",
      run: async () => {
        const { data } = await sb
          .from("vendors")
          .select("id, name")
          .ilike("name", pattern)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((v) => ({
          id: `vendor-${v.id}`,
          type: "vendor" as const,
          label: v.name,
          href: `/vendors`,
        }));
      },
    },
    {
      type: "vehicle",
      label: "Vehicles & equipment",
      run: async () => {
        const { data } = await sb
          .from("assets")
          .select("id, name, year, make, model")
          .or(`name.ilike.${orPattern},make.ilike.${orPattern},model.ilike.${orPattern}`)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((a) => ({
          id: `vehicle-${a.id}`,
          type: "vehicle" as const,
          label: a.name,
          sublabel: [a.year, a.make, a.model].filter(Boolean).join(" "),
          href: `/fleet/reservations`,
        }));
      },
    },
    {
      type: "meeting",
      label: "Meetings",
      run: async () => {
        const { data } = await sb
          .from("meetings")
          .select("id, name")
          .ilike("name", pattern)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((m) => ({
          id: `meeting-${m.id}`,
          type: "meeting" as const,
          label: m.name,
          href: `/meetings/${m.id}`,
        }));
      },
    },
    {
      type: "person",
      label: "Team",
      run: async () => {
        const { data } = await sb
          .from("profiles")
          .select("id, full_name, email")
          .or(`full_name.ilike.${orPattern},email.ilike.${orPattern}`)
          .limit(PER_TYPE_LIMIT);
        return (data ?? []).map((p) => ({
          id: `person-${p.id}`,
          type: "person" as const,
          label: p.full_name || p.email,
          sublabel: p.full_name ? p.email : undefined,
          href: `/team`,
        }));
      },
    },
  ];

  const settled = await Promise.allSettled(sources.map((s) => s.run()));
  const groups: SearchGroup[] = settled
    .map((res, i) => ({
      type: sources[i].type,
      label: sources[i].label,
      hits: res.status === "fulfilled" ? res.value : [],
    }))
    .filter((g) => g.hits.length > 0);

  return { query, groups };
}

function stageLabel(stage: string | null | undefined): string {
  if (!stage) return "";
  return stage.replace(/_/g, " ");
}

function money(n: number | null | undefined): string {
  if (n == null) return "";
  if (n >= 1_000_000) return `$${Math.round(n / 100_000) / 10}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}
