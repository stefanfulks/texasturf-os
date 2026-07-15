import Link from "next/link";
import { Calculator, SquareKanban, Table2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getOpenDeals,
  getContactsByIds,
  getJobberClientNames,
  getLastActivityMap,
} from "@/lib/sales/queries";
import { openPipelineValue, weightedPipeline } from "@/lib/sales/rollups";
import { assessDeal } from "@/lib/sales/risk";
import { today } from "@/lib/sales/dates";
import { usd } from "@/lib/sales/format";
import type { Deal, DealActivity, Health } from "@/lib/sales/types";
import { getTagsForEntities, listTags } from "@/lib/tags/queries";
import { PipelineBoard } from "@/components/sales/PipelineBoard";
import { DealTable } from "@/components/sales/DealTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales · TexasTurf OS" };

/** Synthesize a one-item activity list so per-card health can use last-touch. */
function lastTouchActivities(deal: Deal, lastAt?: string): DealActivity[] {
  if (!lastAt) return [];
  return [
    {
      id: "x",
      deal_id: deal.id,
      kind: "note",
      body: null,
      direction: null,
      metadata: {},
      occurred_at: lastAt,
      created_by: null,
    },
  ];
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const isTable = view === "table";

  const deals = await getOpenDeals();

  // Name maps. Contact names key by DEAL id (a deal links one prospect); Jobber
  // names key by jobber_client_id; owner names key by owner_id (profiles).
  const contactIds = [
    ...new Set(deals.map((d) => d.sales_contact_id).filter(Boolean) as string[]),
  ];
  const jobberIds = [
    ...new Set(deals.map((d) => d.jobber_client_id).filter(Boolean) as string[]),
  ];
  const ownerIds = [
    ...new Set(deals.map((d) => d.owner_id).filter(Boolean) as string[]),
  ];

  const [contacts, jobberNames, lastActivity, tagsByDeal, tagRegistryRows] =
    await Promise.all([
      getContactsByIds(contactIds),
      getJobberClientNames(jobberIds),
      getLastActivityMap(deals.map((d) => d.id)),
      getTagsForEntities("deal", deals.map((d) => d.id)),
      listTags(),
    ]);
  const tagRegistry = tagRegistryRows.map((t) => ({
    id: t.id, name: t.name, slug: t.slug, color: t.color,
  }));

  // Owner names from profiles (typed client — profiles is in the generated DB type).
  const ownerNames: Record<string, string> = {};
  if (ownerIds.length) {
    const sb = await createClient();
    const { data } = await sb
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) ownerNames[p.id] = p.full_name;
    }
  }

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const contactNames: Record<string, string> = {};
  for (const d of deals) {
    const name =
      (d.sales_contact_id && contactById.get(d.sales_contact_id)?.name) ||
      (d.jobber_client_id && jobberNames[d.jobber_client_id]) ||
      null;
    if (name) contactNames[d.id] = name;
  }

  const now = today();
  const healthById: Record<string, Health> = {};
  for (const d of deals) {
    healthById[d.id] = assessDeal(
      d,
      lastTouchActivities(d, lastActivity[d.id]),
      now,
    ).health;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            {usd(openPipelineValue(deals))} open ·{" "}
            {usd(weightedPipeline(deals))} weighted
          </p>
          <h1 className="mt-1 page-title">Sales pipeline</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/materials-calculator" className="btn btn-line btn-sm">
            <Calculator className="size-3.5" />
            Materials calculator
          </Link>
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            <Link
              href="/sales"
              className={
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors " +
                (!isTable
                  ? "bg-ink text-canvas"
                  : "text-ink-3 hover:text-ink")
              }
            >
              <SquareKanban className="size-3.5" />
              Board
            </Link>
            <Link
              href="/sales?view=table"
              className={
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors " +
                (isTable ? "bg-ink text-canvas" : "text-ink-3 hover:text-ink")
              }
            >
              <Table2 className="size-3.5" />
              Table
            </Link>
          </div>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center text-sm text-ink-3">
          No open deals yet. New deals show up here as the pipeline fills.
        </div>
      ) : isTable ? (
        <DealTable
          deals={deals}
          contactNames={contactNames}
          ownerNames={ownerNames}
          healthById={healthById}
        />
      ) : (
        <PipelineBoard
          deals={deals}
          contactNames={contactNames}
          ownerNames={ownerNames}
          healthById={healthById}
          tagsByDeal={tagsByDeal}
          tagRegistry={tagRegistry}
        />
      )}
    </div>
  );
}
