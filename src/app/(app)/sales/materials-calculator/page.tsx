import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MaterialsCalculator } from "./calculator";

export const metadata = {
  title: "Materials Calculator · TexasTurf OS",
};

export default async function MaterialsCalculatorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <Link href="/sales" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Sales
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Materials Calculator</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Quote river rock, decomposed granite, mulch, soil and more — in tons,
          cubic yards, bags or bales.
        </p>
      </div>
      <MaterialsCalculator />
    </div>
  );
}
