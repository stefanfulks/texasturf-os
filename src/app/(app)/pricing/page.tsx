import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PricingCalculator } from "./pricing-calculator";

export const metadata = {
  title: "Pricing Calculator · TexasTurf OS",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Pricing Calculator</h1>
        <p className="text-sm text-ink-3 mt-0.5">
          Enter job details, target a margin, get price + commission + company net instantly.
        </p>
      </div>
      <PricingCalculator />
    </div>
  );
}
