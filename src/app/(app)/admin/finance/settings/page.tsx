import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { FinTableEditor, type FieldDef } from "./settings-editors";

const ACCOUNT_FIELDS: FieldDef[] = [
  { key: "id", label: "ID", type: "text" },
  { key: "name", label: "Name", type: "text" },
  { key: "section", label: "Section", type: "text" },
  { key: "cost_behavior", label: "Fixed/Variable", type: "text" },
  { key: "direct_type", label: "Direct type", type: "text" },
  { key: "reclass_note", label: "Reclass note", type: "text" },
];
const UNIT_FIELDS: FieldDef[] = [
  { key: "name", label: "Business unit", type: "text" },
  { key: "annual_budget", label: "Annual budget", type: "number" },
  { key: "display_order", label: "Order", type: "number" },
];
const PRODUCT_FIELDS: FieldDef[] = [
  { key: "name", label: "Product", type: "text" },
  { key: "category", label: "Category", type: "text" },
  { key: "raw_cost_per_sqft", label: "Cost $/sqft", type: "number" },
  { key: "roll_size", label: "Roll size", type: "text" },
];
const ROLE_FIELDS: FieldDef[] = [
  { key: "name", label: "Labor role", type: "text" },
  { key: "display_order", label: "Order", type: "number" },
];
const QB_MAP_FIELDS: FieldDef[] = [
  { key: "qb_account_name", label: "QuickBooks account", type: "text" },
  { key: "fin_account_id", label: "Maps to account id", type: "text" },
];

export default async function FinanceSettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: accounts }, { data: units }, { data: products }, { data: roles }, { data: settings }, { data: qbMap }] = await Promise.all([
    supabase.from("fin_account").select("*").order("sort_order"),
    supabase.from("fin_business_unit").select("*").order("display_order"),
    supabase.from("fin_product").select("*").order("name"),
    supabase.from("fin_labor_role").select("*").order("display_order"),
    supabase.from("fin_company_settings").select("*").eq("fiscal_year", 2026).single(),
    supabase.from("fin_qb_account_map").select("*").order("qb_account_name"),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-ink">Finance settings</h1>
        <p className="text-ink-3 text-sm">
          FY{settings?.fiscal_year ?? 2026} · revenue plan {settings ? `$${Number(settings.annual_revenue_plan).toLocaleString()}` : "—"}. Edit the backbone every finance tool reads.
        </p>
      </header>
      <section className="space-y-2">
        <h2 className="font-medium text-ink">Chart of accounts</h2>
        <p className="text-ink-4 text-xs">section: income · other_direct · indirect_fixed · other_income · other_expense — cost_behavior: variable/fixed</p>
        <FinTableEditor table="fin_account" fields={ACCOUNT_FIELDS} rows={accounts ?? []} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium text-ink">Business units</h2>
        <FinTableEditor table="fin_business_unit" fields={UNIT_FIELDS} rows={units ?? []} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium text-ink">Products &amp; costs</h2>
        <FinTableEditor table="fin_product" fields={PRODUCT_FIELDS} rows={products ?? []} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium text-ink">Labor roles</h2>
        <FinTableEditor table="fin_labor_role" fields={ROLE_FIELDS} rows={roles ?? []} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium text-ink">QuickBooks account map</h2>
        <p className="text-ink-4 text-xs">Each QuickBooks account maps to a chart-of-accounts id (e.g. revenue, cogs_materials, subcontractor). Unmapped lines land in &quot;unmapped&quot;.</p>
        <FinTableEditor table="fin_qb_account_map" fields={QB_MAP_FIELDS} rows={qbMap ?? []} />
      </section>
    </div>
  );
}
