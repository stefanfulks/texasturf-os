import Link from "next/link";
import { listPullListsForListPage } from "@/lib/warehouse/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pull Lists · TexasTurf OS" };

const STATUS_FILTERS = [
  { key: "all",        label: "All" },
  { key: "draft",      label: "Draft" },
  { key: "pulled",     label: "Pulled" },
  { key: "staged",     label: "Staged" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered",  label: "Delivered" },
] as const;

const STATUS_TONE: Record<string, string> = {
  draft:      "bg-sunken text-ink-2",
  pulled:     "bg-warn-tint text-warn",
  staged:     "bg-info-tint text-info",
  dispatched: "bg-info-tint text-info",
  delivered:  "bg-brand-tint text-brand",
};

export default async function PullListsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter = STATUS_FILTERS.some((f) => f.key === status) ? status! : "all";

  const rows = await listPullListsForListPage({
    status: activeFilter === "all" ? undefined : activeFilter,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pull Lists</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            Daily material assembly per job. Replaces the Pull List PDF.
          </p>
        </div>
        <Link
          href="/operations/pull-lists/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink"
        >
          + New pull list
        </Link>
      </div>

      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((f) => {
          const active = f.key === activeFilter;
          const href = f.key === "all" ? "/operations/pull-lists" : `/operations/pull-lists?status=${f.key}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink-2 hover:border-line-strong")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
          <p className="text-sm font-medium text-ink-2">No pull lists yet.</p>
          <p className="mt-1 text-xs text-ink-3">
            Start one for today&apos;s job — assign crew, pick rolls, sign off when staged.
          </p>
          <Link
            href="/operations/pull-lists/new"
            className="mt-4 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink"
          >
            + New pull list
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-hover text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-3 py-2 font-medium">Job date</th>
                <th className="px-3 py-2 font-medium">Client / Job</th>
                <th className="px-3 py-2 font-medium">Crew lead</th>
                <th className="px-3 py-2 font-medium text-right">Rolls</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-hover">
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {r.job_date}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{r.client_name ?? "—"}</div>
                    {r.job_number && (
                      <div className="text-xs text-ink-3">#{r.job_number}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-2">
                    {r.crew_lead_employee?.display_name ?? r.crew_lead ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.warehouse_pull_list_rolls?.length ?? 0}
                  </td>
                  <td className="px-3 py-2">
                    <span className={"inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize " + (STATUS_TONE[r.status] ?? "bg-sunken text-ink-2")}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/operations/pull-lists/${r.id}`}
                      className="text-xs font-medium text-ink-2 hover:text-ink"
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
