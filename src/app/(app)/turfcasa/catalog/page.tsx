import { redirect } from "next/navigation";
import { Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_UNIT_LABELS,
  type ProductCategory,
  type ProductUnit,
} from "@/lib/turfcasa/constants";
import { updateProductPrices } from "./actions";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function TurfcasaCatalogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  const { data: products } = await supabase
    .from("turfcasa_products")
    .select("*")
    .order("sort_order");

  const missingPrices = (products ?? []).filter(
    (p) => p.visible && p.retail_price == null,
  ).length;

  const byCategory = new Map<string, NonNullable<typeof products>>();
  for (const p of products ?? []) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">TurfCasa</p>
        <h1 className="page-title">Catalog</h1>
        <p className="mt-1 text-sm text-ink-2">
          Every SKU carries a trade price and a retail price — trade pricing from roll one is
          the whole pitch. These prices feed order entry and, later, the website.
        </p>
      </div>

      {missingPrices > 0 ? (
        <p className="rounded-xl border border-warn/30 bg-warn-tint px-4 py-2.5 text-sm text-warn">
          {missingPrices} visible {missingPrices === 1 ? "product needs" : "products need"} pricing —
          {isAdmin ? " fill in the fields below." : " an admin fills these in."}
        </p>
      ) : null}

      {!products?.length ? (
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-warn"><Tags className="h-5 w-5" /></span>
            <p className="empty-state-title">Catalog is empty</p>
            <p className="empty-state-body">The seed migration hasn&apos;t run yet.</p>
          </div>
        </div>
      ) : (
        PRODUCT_CATEGORIES.filter((c) => byCategory.has(c)).map((cat) => (
          <div key={cat} className="panel">
            <div className="panel-head">
              <p className="text-sm font-semibold text-ink">
                {PRODUCT_CATEGORY_LABELS[cat as ProductCategory]}
              </p>
            </div>
            {/* Header row */}
            <div className="hidden sm:flex items-center gap-3 px-5 py-2 text-xs font-medium uppercase tracking-wide text-ink-4">
              <span className="flex-1">Product</span>
              <span className="w-16">Unit</span>
              <span className="w-28 text-right">Trade $</span>
              <span className="w-28 text-right">Retail $</span>
              {isAdmin ? <span className="w-16" /> : null}
            </div>
            <div className="divide-y divide-line">
              {byCategory.get(cat)!.map((p) =>
                isAdmin ? (
                  <form
                    key={p.id}
                    action={updateProductPrices}
                    className="flex flex-wrap items-center gap-3 px-5 py-2.5"
                  >
                    <input type="hidden" name="product_id" value={p.id} />
                    <span className="min-w-40 flex-1 text-sm text-ink">
                      {p.name}
                      {!p.visible ? <span className="chip ml-2">Hidden</span> : null}
                    </span>
                    <span className="w-16 text-xs text-ink-3">
                      per {PRODUCT_UNIT_LABELS[p.unit as ProductUnit] ?? p.unit}
                    </span>
                    <input
                      name="trade_price"
                      defaultValue={p.trade_price ?? ""}
                      inputMode="decimal"
                      placeholder="—"
                      className="field-input num !w-28 text-right"
                      aria-label={`${p.name} trade price`}
                    />
                    <input
                      name="retail_price"
                      defaultValue={p.retail_price ?? ""}
                      inputMode="decimal"
                      placeholder="—"
                      className="field-input num !w-28 text-right"
                      aria-label={`${p.name} retail price`}
                    />
                    <button type="submit" className="btn !px-3 !py-1.5 text-xs">
                      Save
                    </button>
                  </form>
                ) : (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                    <span className="min-w-40 flex-1 text-sm text-ink">{p.name}</span>
                    <span className="w-16 text-xs text-ink-3">
                      per {PRODUCT_UNIT_LABELS[p.unit as ProductUnit] ?? p.unit}
                    </span>
                    <span className="num w-28 text-right text-sm text-ink-2">
                      {p.trade_price != null ? money.format(p.trade_price) : "—"}
                    </span>
                    <span className="num w-28 text-right text-sm text-ink-2">
                      {p.retail_price != null ? money.format(p.retail_price) : "—"}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
