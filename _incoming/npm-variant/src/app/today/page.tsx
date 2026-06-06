import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const sb = supabaseAdmin();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data: visits, error } = await sb
    .from("jobber_visits")
    .select("id, title, starts_at, ends_at, is_complete, client_id, assigned_user_ids")
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at", { ascending: true });

  const clientIds = [...new Set((visits ?? []).map((v) => v.client_id).filter(Boolean) as string[])];
  const { data: clients } = clientIds.length
    ? await sb
        .from("jobber_clients")
        .select("id, company_name, first_name, last_name")
        .in("id", clientIds)
    : { data: [] };
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

  return (
    <main className="min-h-dvh bg-zinc-50 px-8 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">
            Today —{" "}
            {start.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h1>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← Home
          </Link>
        </div>

        {error && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error.message}
          </p>
        )}

        <div className="mt-6 space-y-2">
          {(visits ?? []).map((v) => {
            const c = v.client_id ? clientMap.get(v.client_id) : null;
            const clientName =
              c?.company_name ??
              [c?.first_name, c?.last_name].filter(Boolean).join(" ") ??
              "—";
            return (
              <div
                key={v.id}
                className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="w-20 text-sm tabular-nums text-zinc-500">
                  {v.starts_at
                    ? new Date(v.starts_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : ""}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{v.title || clientName}</div>
                  <div className="text-sm text-zinc-500">{clientName}</div>
                </div>
                <div className="text-xs text-zinc-500">
                  {v.assigned_user_ids?.length ?? 0} assigned
                </div>
                {v.is_complete && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    done
                  </span>
                )}
              </div>
            );
          })}
          {(!visits || visits.length === 0) && !error && (
            <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
              No visits synced for today yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
