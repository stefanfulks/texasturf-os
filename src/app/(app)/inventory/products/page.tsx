import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "./product-form";
import { ProductRow } from "./product-row";
import type { InvProduct, RollStatus } from "@/lib/db-helpers.types";

const IN_STOCK_STATUSES: RollStatus[] = ["available", "allocated"];

export default async function InventoryProductsPage() {
  const supabase = await createClient();

  const [productsRes, rollsRes] = await Promise.all([
    supabase.from("inv_products").select("*").order("name"),
    supabase.from("inv_rolls").select("product_id, status"),
  ]);

  const products = (productsRes.data ?? []) as InvProduct[];

  const inStockCounts = new Map<string, number>();
  for (const r of rollsRes.data ?? []) {
    if (!r.product_id) continue;
    if (!IN_STOCK_STATUSES.includes(r.status as RollStatus)) continue;
    inStockCounts.set(r.product_id, (inStockCounts.get(r.product_id) ?? 0) + 1);
  }

  const active = products.filter((p) => p.active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            {active} active · {products.length} total
          </p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold mb-4">Add Product</h2>
        <ProductForm mode="create" />
      </div>

      <div className="card overflow-hidden">
        {products.length === 0 ? (
          <div className="empty-state">
            <span className="medallion"><Package className="h-5 w-5" /></span>
            <p className="empty-state-title">No products yet</p>
            <p className="empty-state-body">Add a product above and rolls can be received against it.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover">
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">SKU</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">Width</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-2">Description</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-2">Rolls in Stock</th>
                  <th className="text-center px-4 py-3 font-semibold text-ink-2">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    rollsInStock={inStockCounts.get(p.id) ?? 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
