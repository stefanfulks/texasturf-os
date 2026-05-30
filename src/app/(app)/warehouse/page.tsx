import { redirect } from "next/navigation";
import { Package, ClipboardList, Boxes, ArrowDownCircle, ArrowUpCircle, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SectionCard } from "@/components/section-card";

export const metadata = { title: "Warehouse · TexasTurf OS" };

export default async function WarehousePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Live counts for the cards
  const [rollsRes, jobsRes, lowStockRes, pendingReceiveRes] = await Promise.all([
    supabase.from("inv_rolls").select("id", { count: "exact", head: true }).in("status", ["available","planned"]),
    supabase.from("inv_jobs").select("id", { count: "exact", head: true }).in("status", ["planning","in_progress","staged"]),
    supabase.from("inv_items").select("id, quantity, min_quantity").eq("active", true),
    supabase.from("inv_rolls").select("id", { count: "exact", head: true }).eq("status", "planned"),
  ]);
  const lowStockCount = (lowStockRes.data ?? []).filter(
    (i) => i.min_quantity != null && i.quantity != null && i.quantity <= i.min_quantity,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Warehouse</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Roll inventory, receiving, cuts, returns — everything the warehouse touches.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          href="/inventory"
          title="Inventory Dashboard"
          description="Live counts, recent transactions, low stock — at a glance."
          icon={<Package className="h-5 w-5" />}
          accent="emerald"
        />
        <SectionCard
          href="/inventory/rolls"
          title="Rolls"
          description="All physical rolls — parent and child, by status and location."
          icon={<Boxes className="h-5 w-5" />}
          badge={rollsRes.count ?? null}
          accent="blue"
        />
        <SectionCard
          href="/inventory/jobs"
          title="Jobs"
          description="Active warehouse jobs and their allocations."
          icon={<ClipboardList className="h-5 w-5" />}
          badge={jobsRes.count ?? null}
          accent="purple"
        />
        <SectionCard
          href="/inventory/receive"
          title="Receive"
          description="Log incoming rolls, bulk-paste from a shipment."
          icon={<ArrowDownCircle className="h-5 w-5" />}
          badge={pendingReceiveRes.count ?? null}
          accent="green"
        />
        <SectionCard
          href="/inventory/returns"
          title="Returns"
          description="Process returns from a job — restock or mark damaged."
          icon={<ArrowUpCircle className="h-5 w-5" />}
          accent="amber"
        />
        <SectionCard
          href="/inventory/items"
          title="Non-roll items"
          description="Hardware, supplies, consumables."
          icon={<Boxes className="h-5 w-5" />}
          badge={lowStockCount > 0 ? `${lowStockCount} low` : null}
          accent={lowStockCount > 0 ? "red" : "neutral"}
        />
        <SectionCard
          href="/inventory/locations"
          title="Locations"
          description="Warehouse bays, rows, and bins."
          icon={<MapPin className="h-5 w-5" />}
          accent="neutral"
        />
        <SectionCard
          href="/inventory/transactions"
          title="Transaction Log"
          description="Append-only audit log of every roll movement."
          icon={<ClipboardList className="h-5 w-5" />}
          accent="neutral"
        />
        <SectionCard
          href="/inventory/reports"
          title="Inventory Reports"
          description="Aging, overage, value — the warehouse's KPIs."
          icon={<ClipboardList className="h-5 w-5" />}
          accent="yellow"
        />
      </div>
    </div>
  );
}
