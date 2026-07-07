import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const CATEGORY_LABELS: Record<string, string> = {
  tool:            "Tool",
  small_equipment: "Small equipment",
  supply:          "Supply",
};

type PurchaseDetail = {
  id: string;
  asset_id: string | null;
  purchase_date: string;
  item_name: string;
  vendor: string | null;
  quantity: number;
  cost_cents: number;
  category: string;
  crew: string | null;
  receipt_url: string | null;
  submitted_by_employee_id: string | null;
  submitted_by_profile: string | null;
  created_at: string;
  asset: { name: string; unit_type: string } | null;
  submitter: { display_name: string } | null;
  profile_submitter: { full_name: string | null; email: string | null } | null;
};

function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month:   "long",
    day:     "numeric",
    year:    "numeric",
  });
}

export default async function ToolPurchaseDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const sb = await createClient();
  const { data, error } = await sb
    .from("warehouse_tool_purchases")
    .select(
      "id, asset_id, purchase_date, item_name, vendor, quantity, cost_cents, category, " +
      "crew, receipt_url, submitted_by_employee_id, submitted_by_profile, created_at, " +
      "asset:asset_id(name, unit_type), " +
      "submitter:submitted_by_employee_id(display_name), " +
      "profile_submitter:submitted_by_profile(full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();

  const p = data as unknown as PurchaseDetail;
  const submitter =
    p.submitter?.display_name
    || p.profile_submitter?.full_name?.trim()
    || p.profile_submitter?.email?.split("@")[0]
    || null;
  const lineTotal = (p.cost_cents ?? 0) * (p.quantity ?? 1);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/operations/tools" className="text-xs text-ink-3 hover:text-ink">
          ← All purchases
        </Link>
        <h1 className="mt-1 page-title">{p.item_name}</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          {fmtDate(p.purchase_date)}
          {p.vendor && <> · {p.vendor}</>}
        </p>
      </div>

      <Card title="Purchase">
        <Stat name="Category"     value={CATEGORY_LABELS[p.category] ?? p.category} />
        <Stat name="Quantity"     value={p.quantity ?? 1} />
        <Stat name="Cost (each)"  value={fmtUSD(p.cost_cents ?? 0)} />
        <Stat name="Line total"   value={<strong>{fmtUSD(lineTotal)}</strong>} />
        {p.crew && <Stat name="Crew" value={p.crew} />}
      </Card>

      {p.asset && (
        <Card title="For">
          <Stat name="Asset"     value={p.asset.name} />
          <Stat name="Unit type" value={p.asset.unit_type.replace("_", " ")} />
        </Card>
      )}

      {submitter && (
        <Card title="Submitted by">
          <p className="text-sm font-medium text-ink">{submitter}</p>
        </Card>
      )}

      {p.receipt_url && (
        <Card title="Receipt">
          <a
            href={p.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-2 underline-offset-2 hover:underline break-all"
          >
            Open receipt ↗
          </a>
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-ink-3">{name}</span>
      <span className="font-medium text-ink text-right">{value}</span>
    </div>
  );
}
