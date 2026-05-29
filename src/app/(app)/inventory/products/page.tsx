import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "./product-form";
import { ProductRow } from "./product-row";
import type { InvProduct, RollStatus } from "@/lib/database.types";

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
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {active} active · {products.length} total
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold mb-4">Add Product</h2>
        <ProductForm mode="create" />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {products.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            No products yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">SKU</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Width</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Rolls in Stock</th>
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  rollsInStock={inStockCounts.get(p.id) ?? 0}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
