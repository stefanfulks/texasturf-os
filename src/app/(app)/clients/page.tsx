import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTagsForEntities, listTags } from "@/lib/tags/queries";
import { chipClasses } from "@/lib/tags/colors";
import { TagChips } from "@/components/tags/TagChips";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tags?: string }>;
}) {
  const { q, tags: tagsParam } = await searchParams;
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

  // Tag filter is URL-driven (?tags=slug1,slug2 — ANY-match) so this page can
  // stay a server component, mirroring the ?q= search form above.
  const registry = await listTags();
  const selectedSlugs = new Set(
    (tagsParam ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const tagsByClient = await getTagsForEntities(
    "jobber_client",
    (data ?? []).map((c) => c.id),
  );
  const rows = (data ?? []).filter(
    (c) =>
      selectedSlugs.size === 0 ||
      (tagsByClient[c.id] ?? []).some((t) => selectedSlugs.has(t.slug)),
  );

  // Build the href for toggling a tag chip, preserving the search term.
  const toggleHref = (slug: string) => {
    const next = new Set(selectedSlugs);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    const params = new URLSearchParams();
    if (q && q.trim()) params.set("q", q.trim());
    if (next.size > 0) params.set("tags", [...next].join(","));
    const qs = params.toString();
    return qs ? `/clients?${qs}` : "/clients";
  };

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
        {selectedSlugs.size > 0 && (
          <input type="hidden" name="tags" value={[...selectedSlugs].join(",")} />
        )}
      </form>

      {registry.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {registry.map((t) => {
            const on = selectedSlugs.has(t.slug);
            return (
              <Link
                key={t.id}
                href={toggleHref(t.slug)}
                className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
                  on ? chipClasses(t.color) : "border-line text-ink-3 hover:bg-ink/5"
                }`}
              >
                {t.name}
              </Link>
            );
          })}
        </div>
      )}

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
            {rows.map((c) => (
              <tr key={c.id} className="row-link border-t border-line">
                <td className="px-3 py-2">
                  <Link href={`/clients/${c.id}`} className="block font-medium text-ink hover:text-brand transition-colors">
                    {c.company_name ??
                      [c.first_name, c.last_name].filter(Boolean).join(" ") ??
                      "—"}
                  </Link>
                  {(tagsByClient[c.id] ?? []).length > 0 && (
                    <div className="mt-1">
                      <TagChips tags={tagsByClient[c.id] ?? []} />
                    </div>
                  )}
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
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-ink-3">
                  {selectedSlugs.size > 0
                    ? "No clients match the selected tags."
                    : "No clients synced yet. Connect Jobber and run a sync."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list (< md) — field workers on phones */}
      <div className="mt-6 md:hidden space-y-2">
        {rows.map((c) => {
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
              {(tagsByClient[c.id] ?? []).length > 0 && (
                <div className="mt-1.5">
                  <TagChips tags={tagsByClient[c.id] ?? []} />
                </div>
              )}
            </Link>
          );
        })}
        {rows.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-ink-3">
            {selectedSlugs.size > 0
              ? "No clients match the selected tags."
              : "No clients synced yet. Connect Jobber and run a sync."}
          </div>
        )}
      </div>
    </div>
  );
}
