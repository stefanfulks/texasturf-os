import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "./order-form";

export default async function NewTurfcasaOrderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: products } = await supabase
    .from("turfcasa_products")
    .select("id, name, unit, retail_price, trade_price")
    .eq("visible", true)
    .order("sort_order");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="eyebrow mb-2">TurfCasa</p>
        <h1 className="page-title">New order</h1>
        <p className="mt-1 text-sm text-ink-2">
          Phone or walk-in order. Website orders arrive on their own — this form is for
          everything else.
        </p>
      </div>
      <OrderForm products={products ?? []} />
    </div>
  );
}
