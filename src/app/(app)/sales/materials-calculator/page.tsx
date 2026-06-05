import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
    <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      <Link
        href="/sales"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-zinc-500 hover:text-zinc-900 active:text-zinc-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Sales
      </Link>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          Materials Calculator
        </h1>
        <p className="text-sm sm:text-base text-zinc-600 mt-1">
          Tell us the area — get tons & cubic yards in seconds.
        </p>
      </div>
      <MaterialsCalculator />
    </div>
  );
}
