import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UnmatchedCallsTable, type UnmatchedRow } from "@/components/sales/UnmatchedCallsTable";

export const metadata = { title: "Inbox · Sales · TexasTurf OS" };

interface ActivityRow {
  id: string;
  deal_id: string;
  kind: string;
  direction: string | null;
  body: string | null;
  occurred_at: string;
}

export default async function SalesInboxPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: openRows } = await sb
    .from("unmatched_calls")
    .select("id, from_number, recording_url, duration_sec, transcript, occurred_at")
    .is("resolved_at", null)
    .order("occurred_at", { ascending: false })
    .limit(50);

  const unmatched = (openRows ?? []) as UnmatchedRow[];

  const { data: actRows } = await sb
    .from("deal_activities")
    .select("id, deal_id, kind, direction, body, occurred_at")
    .in("kind", ["sms", "call"])
    .eq("direction", "inbound")
    .order("occurred_at", { ascending: false })
    .limit(25);

  const recent = (actRows ?? []) as ActivityRow[];

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      <div>
        <h1 className="page-title">Sales Inbox</h1>
        <p className="text-sm sm:text-base text-ink-2 mt-1">
          Voicemails from numbers not in your CRM, plus a feed of recent inbound calls and texts across all deals.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink mb-2">Unmatched voicemails ({unmatched.length})</h2>
        <UnmatchedCallsTable rows={unmatched} />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink mb-2">Recent inbound activity</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-3 py-4">No inbound calls or texts yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <Link href={`/sales/deals/${a.deal_id}`} className="text-ink hover:underline">
                  <span className="font-medium capitalize">{a.kind}</span>
                  <span className="text-ink-3"> · {new Date(a.occurred_at).toLocaleString()}</span>
                  {a.body && <span className="block text-ink-2 mt-0.5 line-clamp-1">{a.body}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
