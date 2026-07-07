import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  // User-context client so RLS applies (jobber_clients has an authenticated
  // read policy) — no service-role on a user-facing page.
  const sb = await createClient();
  let query = sb
    .from("jobber_clients")
    .select("id, first_name, last_name, company_name, emails, phones, balance_cents, is_archived")
    .order("company_name", { ascending: true, nullsFirst: false })
    .limit(200);
  if (q && q.trim().length > 0) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `company_name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`,
    );
  }
  const { data, error } = await query;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="page-title">Clients</h1>
        <Link
          href="/settings/jobber"
          className="text-sm text-ink-3 hover:underline"
        >
          Sync settings →
        </Link>
      </div>
      <form className="mt-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by company or name…"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
        />
      </form>

      {error && (
        <p className="mt-6 rounded-md border border-danger/30 bg-danger-tint p-3 text-sm text-danger">
          {error.message}
        </p>
      )}

      {/* Desktop table (md+) */}
      <div className="mt-6 hidden md:block overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-sunken text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className="row-link border-t border-line">
                <td className="px-3 py-2">
                  <Link href={`/clients/${c.id}`} className="block font-medium text-ink hover:text-brand transition-colors">
                    {c.company_name ??
                      [c.first_name, c.last_name].filter(Boolean).join(" ") ??
                      "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink-2">
                  {(c.emails as { address: string }[])?.[0]?.address ?? ""}
                </td>
                <td className="px-3 py-2 text-ink-2">
                  {(c.phones as { number: string }[])?.[0]?.number ?? ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.balance_cents != null
                    ? `$${(c.balance_cents / 100).toFixed(2)}`
                    : ""}
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && !error && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-ink-3">
                  No clients synced yet. Connect Jobber and run a sync.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list (< md) — field workers on phones */}
      <div className="mt-6 md:hidden space-y-2">
        {(data ?? []).map((c) => {
          const name =
            c.company_name ??
            [c.first_name, c.last_name].filter(Boolean).join(" ") ??
            "—";
          const email = (c.emails as { address: string }[])?.[0]?.address ?? "";
          const phone = (c.phones as { number: string }[])?.[0]?.number ?? "";
          return (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="block card card-hover p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-ink truncate">{name}</p>
                {c.balance_cents != null && (
                  <p className="text-sm tabular-nums text-ink-2">
                    ${(c.balance_cents / 100).toFixed(2)}
                  </p>
                )}
              </div>
              {(email || phone) && (
                <p className="mt-1 text-xs text-ink-3 truncate">
                  {[email, phone].filter(Boolean).join(" · ")}
                </p>
              )}
            </Link>
          );
        })}
        {(!data || data.length === 0) && !error && (
          <div className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-ink-3">
            No clients synced yet. Connect Jobber and run a sync.
          </div>
        )}
      </div>
    </div>
  );
}
