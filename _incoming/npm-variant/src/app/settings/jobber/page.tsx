import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JobberSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const { connected } = await searchParams;
  const sb = supabaseAdmin();
  const { data: accounts } = await sb
    .from("jobber_oauth_tokens")
    .select("jobber_account_id, installed_at, updated_at, scopes, expires_at");

  const { data: lastEvents } = await sb
    .from("jobber_webhook_events")
    .select("topic, received_at, hmac_valid, process_error")
    .order("received_at", { ascending: false })
    .limit(10);

  return (
    <main className="min-h-dvh bg-zinc-50 px-8 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Jobber connection</h1>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← Home
          </Link>
        </div>

        {connected === "1" && (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Jobber account connected.
          </p>
        )}

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">Connected accounts</h2>
          {(accounts ?? []).length === 0 ? (
            <div className="mt-3 text-sm text-zinc-500">
              No Jobber account connected yet.
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(accounts ?? []).map((a) => (
                <li
                  key={a.jobber_account_id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-zinc-100 p-3 dark:border-zinc-800"
                >
                  <div>
                    <div className="font-mono text-xs">
                      {a.jobber_account_id}
                    </div>
                    <div className="text-xs text-zinc-500">
                      installed {new Date(a.installed_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    scopes: {a.scopes?.join(" ") || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <a
            href="/api/jobber/connect"
            className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            {accounts && accounts.length > 0 ? "Reconnect Jobber" : "Connect Jobber"}
          </a>
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">Recent webhook events</h2>
          {(lastEvents ?? []).length === 0 ? (
            <div className="mt-3 text-sm text-zinc-500">No events yet.</div>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {(lastEvents ?? []).map((e, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between border-b border-zinc-100 py-1 last:border-0 dark:border-zinc-800"
                >
                  <span className="font-mono text-xs">{e.topic}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(e.received_at).toLocaleString()}
                    {!e.hmac_valid && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 text-red-800">
                        bad sig
                      </span>
                    )}
                    {e.process_error && (
                      <span className="ml-2 rounded bg-yellow-100 px-1.5 text-yellow-800">
                        err
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
