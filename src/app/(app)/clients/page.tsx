import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const sb = supabaseAdmin();
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
    <div className="mx-auto max-w-5xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Link
          href="/settings/jobber"
          className="text-sm text-zinc-500 hover:underline"
        >
          Sync settings →
        </Link>
      </div>
      <form className="mt-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by company or name…"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
      </form>

      {error && (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error.message}
        </p>
      )}

      {/* Desktop table (md+) */}
      <div className="mt-6 hidden md:block overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-zinc-200">
                <td className="px-3 py-2">
                  {c.company_name ??
                    [c.first_name, c.last_name].filter(Boolean).join(" ") ??
                    "—"}
                </td>
                <td className="px-3 py-2 text-zinc-600">
                  {(c.emails as { address: string }[])?.[0]?.address ?? ""}
                </td>
                <td className="px-3 py-2 text-zinc-600">
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
                <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
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
            <div
              key={c.id}
              className="rounded-lg border border-zinc-200 bg-white p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-zinc-900 truncate">{name}</p>
                {c.balance_cents != null && (
                  <p className="text-sm tabular-nums text-zinc-700">
                    ${(c.balance_cents / 100).toFixed(2)}
                  </p>
                )}
              </div>
              {(email || phone) && (
                <p className="mt-1 text-xs text-zinc-500 truncate">
                  {[email, phone].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          );
        })}
        {(!data || data.length === 0) && !error && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No clients synced yet. Connect Jobber and run a sync.
          </div>
        )}
      </div>
    </div>
  );
}
