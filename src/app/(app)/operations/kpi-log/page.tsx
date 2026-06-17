import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  listSections,
  listEntries,
  countPending,
  resolveSignerNames,
  type KpiTarget,
} from "@/lib/kpi-log/queries";
import { SECTION_IDS, isSectionId, SECTION_TITLES, type SectionId } from "@/lib/kpi-log/schemas";
import { TabNav } from "./_components/tab-nav";
import { TargetsBanner } from "./_components/targets-banner";
import { EntryForm } from "./_components/entry-form";
import { EntryTable } from "./_components/entry-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "KPI Log · TexasTurf OS" };

export default async function KpiLogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; pending?: string }>;
}) {
  const { tab, pending } = await searchParams;
  const activeTab: SectionId = tab && isSectionId(tab) ? tab : "material_readiness";
  const pendingOnly = pending === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const role = profile.role as "admin" | "office" | "field";
  const canSubmit = role === "admin" || role === "office";
  const isAdmin = role === "admin";

  const [sections, entries, totalPending] = await Promise.all([
    listSections(),
    listEntries({ sectionId: activeTab, pendingOnly, limit: 100 }),
    countPending(),
  ]);

  // Per-tab pending counts via parallel queries on the same table — small N, cheap.
  const pendingPerTab = await Promise.all(
    SECTION_IDS.map(async (id) => {
      const list = await listEntries({ sectionId: id, pendingOnly: true, limit: 200 });
      return [id, list.length] as const;
    }),
  );
  const pendingByTab = Object.fromEntries(pendingPerTab) as Record<SectionId, number>;

  const signerIds = entries.map((e) => e.mgmt_signed_by).filter((x): x is string => !!x);
  const signerNames = await resolveSignerNames(signerIds);

  const activeSection = sections.find((s) => s.id === activeTab);
  const targets = (activeSection?.targets ?? []) as KpiTarget[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">KPI Log</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            Daily warehouse ops log. Office adds, management signs off.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/operations/kpi-log"
            className={
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (!pendingOnly
                ? "border-ink bg-brand text-white"
                : "border-line bg-white text-ink-2 hover:border-line-strong")
            }
          >
            All
          </Link>
          <Link
            href="/operations/kpi-log?pending=1"
            className={
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (pendingOnly
                ? "border-ink bg-brand text-white"
                : "border-line bg-white text-ink-2 hover:border-line-strong")
            }
          >
            Pending review {totalPending > 0 && `(${totalPending})`}
          </Link>
        </div>
      </div>

      <TabNav pendingByTab={pendingByTab} />

      <div className="space-y-1">
        <h2 className="text-base font-semibold">{SECTION_TITLES[activeTab]}</h2>
      </div>
      <TargetsBanner targets={targets} />

      <EntryForm section={activeTab} canSubmit={canSubmit} />

      <EntryTable
        section={activeTab}
        entries={entries}
        signerNames={signerNames}
        isAdmin={isAdmin}
      />
    </div>
  );
}
