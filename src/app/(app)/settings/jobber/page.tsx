import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SyncButtons } from "./sync-buttons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobber · TexasTurf OS" };

type Account = {
  jobber_account_id: string;
  installed_at: string;
  updated_at: string;
  expires_at: string;
  scopes: string[] | null;
};

type WebhookEvent = {
  topic: string;
  received_at: string;
  hmac_valid: boolean;
  process_error: string | null;
};

export default async function JobberSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { connected } = await searchParams;
  const supa = supabaseAdmin();

  const [accountsRes, eventsRes, clientCountRes, visitCountRes, jobCountRes] = await Promise.all([
    supa.from("jobber_oauth_tokens")
      .select("jobber_account_id, installed_at, updated_at, scopes, expires_at"),
    supa.from("jobber_webhook_events")
      .select("topic, received_at, hmac_valid, process_error")
      .order("received_at", { ascending: false }).limit(10),
    supa.from("jobber_clients").select("id", { count: "exact", head: true }),
    supa.from("jobber_visits").select("id", { count: "exact", head: true }),
    supa.from("jobber_jobs").select("id", { count: "exact", head: true }),
  ]);
  const accounts = (accountsRes.data ?? []) as unknown as Account[];
  const lastEvents = (eventsRes.data ?? []) as unknown as WebhookEvent[];
  const clientCount = clientCountRes.count ?? 0;
  const visitCount  = visitCountRes.count  ?? 0;
  const jobCount    = jobCountRes.count    ?? 0;

  const primaryAccountId = accounts[0]?.jobber_account_id ?? null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Jobber connection</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          Sync clients and visits from Jobber into the OS so the team can see
          them alongside everything else.
        </p>
      </div>

      {connected === "1" && (
        <p className="rounded-lg border border-brand/30 bg-brand-tint px-3 py-2 text-sm text-brand">
          Jobber account connected. You can now run the initial sync below.
        </p>
      )}

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Connected accounts</h2>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No Jobber account connected yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {accounts.map((a) => (
              <li
                key={a.jobber_account_id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line p-3"
              >
                <div>
                  <div className="font-mono text-xs text-ink">{a.jobber_account_id}</div>
                  <div className="text-xs text-ink-3">
                    installed {new Date(a.installed_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-ink-3">
                  scopes: {a.scopes && a.scopes.length > 0 ? a.scopes.join(" ") : "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
        <a
          href="/api/jobber/connect"
          className="btn btn-primary mt-4"
        >
          {accounts.length > 0 ? "Reconnect Jobber" : "Connect Jobber"}
        </a>
      </section>

      {primaryAccountId && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Local mirror</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-line p-3">
              <div className="text-xs text-ink-3">Clients synced</div>
              <div className="text-xl font-semibold tabular-nums">{clientCount}</div>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="text-xs text-ink-3">Visits synced</div>
              <div className="text-xl font-semibold tabular-nums">{visitCount}</div>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="text-xs text-ink-3">Jobs synced</div>
              <div className="text-xl font-semibold tabular-nums">{jobCount}</div>
            </div>
          </div>
          <SyncButtons accountId={primaryAccountId} />
          <p className="mt-2 text-xs text-ink-3">
            Webhooks keep the mirror live going forward. Run a manual sync after
            install or if the webhook misses an event.
          </p>
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Recent webhook events</h2>
        {lastEvents.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No events yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {lastEvents.map((e, i) => (
              <li
                key={i}
                className="flex items-center justify-between border-b border-line py-1 last:border-0"
              >
                <span className="font-mono text-xs">{e.topic}</span>
                <span className="text-xs text-ink-3">
                  {new Date(e.received_at).toLocaleString()}
                  {!e.hmac_valid && (
                    <span className="ml-2 rounded bg-danger-tint px-1.5 text-danger">bad sig</span>
                  )}
                  {e.process_error && (
                    <span className="ml-2 rounded bg-warn-tint px-1.5 text-warn">err</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
