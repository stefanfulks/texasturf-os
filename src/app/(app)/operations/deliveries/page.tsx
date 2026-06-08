import Link from "next/link";
import { listDeliveriesForListPage } from "@/lib/warehouse/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deliveries · TexasTurf OS" };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month:  "short",
    day:    "numeric",
    hour:   "numeric",
    minute: "2-digit",
  });
}

export default async function DeliveriesPage() {
  const rows = await listDeliveriesForListPage({ limit: 100 });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deliveries</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Post-delivery confirmations. One row = one Slack post to the
            warehouse channel.
          </p>
        </div>
        <Link
          href="/operations/deliveries/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Log delivery
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-zinc-700">No deliveries logged yet.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Log one as soon as material lands at the job site so the team can
            see what was delivered.
          </p>
          <Link
            href="/operations/deliveries/new"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            + Log delivery
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Delivered</th>
                <th className="px-3 py-2 font-medium">Client / Job</th>
                <th className="px-3 py-2 font-medium">Received by</th>
                <th className="px-3 py-2 font-medium">Staged at</th>
                <th className="px-3 py-2 font-medium">Slack</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {fmtDate(r.delivered_at)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900">{r.client_name ?? "—"}</div>
                    {r.pull_list?.job_number && (
                      <div className="text-xs text-zinc-500">#{r.pull_list.job_number}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{r.received_by ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-600">{r.staging_location ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.slack_message_ts ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        ✓ posted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        unposted
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/operations/deliveries/${r.id}`}
                      className="text-xs font-medium text-zinc-700 hover:text-zinc-900"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
