import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Budget } from "@/lib/db-helpers.types";
import { BudgetForm } from "./budget-form";

function monthName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { month: monthParam, year: yearParam } = await searchParams;

  const now = new Date();
  const month = Math.min(12, Math.max(1, parseInt(monthParam ?? "") || now.getMonth() + 1));
  const year = Math.max(2020, parseInt(yearParam ?? "") || now.getFullYear());

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "field") {
    redirect("/");
  }

  const { data: budgetsRaw } = await supabase
    .from("budgets")
    .select("*")
    .eq("period_month", month)
    .eq("period_year", year);

  const budgets = (budgetsRaw ?? []) as Budget[];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href={`/reports?month=${month}&year=${year}`}
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            &larr; Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 mt-1">
            Budget &mdash; {monthName(month, year)}
          </h1>
        </div>
      </div>

      <BudgetForm budgets={budgets} month={month} year={year} />
    </div>
  );
}
