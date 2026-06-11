"use server";

// Search across referenceable entities for the #ref autocomplete.
// Runs with the caller's RLS context — people can only reference what they
// can already see.

import { createClient } from "@/lib/supabase/server";
import type { RefSearchResult, RefType } from "@/lib/refs";

const PER_TYPE_CAP = 5;

export async function searchEntities(rawQuery: string): Promise<RefSearchResult[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const term = rawQuery.trim().replace(/[%_,()]/g, "").slice(0, 60);
  if (!term) return [];
  const like = `%${term}%`;

  // Vendor names resolve first so "hillman" can surface Hillman's invoices.
  const vendorsQ = supabase
    .from("vendors")
    .select("id, name")
    .ilike("name", like)
    .limit(PER_TYPE_CAP);

  const tasksQ = supabase
    .from("tasks")
    .select("id, title, status")
    .neq("status", "archived")
    .ilike("title", like)
    .order("updated_at", { ascending: false })
    .limit(PER_TYPE_CAP);

  const projectsQ = supabase
    .from("projects")
    .select("id, name, status, customer_name")
    .eq("archived", false)
    .or(`name.ilike.${like},customer_name.ilike.${like}`)
    .order("updated_at", { ascending: false })
    .limit(PER_TYPE_CAP);

  const clientsQ = supabase
    .from("jobber_clients")
    .select("id, company_name, first_name, last_name")
    .eq("is_archived", false)
    .or(`company_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`)
    .limit(PER_TYPE_CAP);

  const [vendorsRes, tasksRes, projectsRes, clientsRes] = await Promise.all([
    vendorsQ, tasksQ, projectsQ, clientsQ,
  ]);

  const vendorName = new Map((vendorsRes.data ?? []).map((v) => [v.id, v.name]));

  // Invoices match on their own text columns OR on a vendor-name hit.
  const vendorIds = [...vendorName.keys()];
  const invoiceOr = [
    `title.ilike.${like}`,
    `invoice_number.ilike.${like}`,
    `job_name.ilike.${like}`,
    `customer_name.ilike.${like}`,
    ...(vendorIds.length ? [`vendor_id.in.(${vendorIds.join(",")})`] : []),
  ].join(",");

  const invoicesRes = await supabase
    .from("invoices")
    .select("id, title, invoice_number, total_amount, status, vendor_id")
    .neq("status", "archived")
    .or(invoiceOr)
    .order("submitted_at", { ascending: false })
    .limit(PER_TYPE_CAP);

  const results: RefSearchResult[] = [];

  for (const t of tasksRes.data ?? []) {
    results.push({ type: "task" as RefType, id: t.id, label: t.title, sublabel: t.status.replace(/_/g, " ") });
  }
  for (const p of projectsRes.data ?? []) {
    results.push({ type: "project", id: p.id, label: p.name, sublabel: p.customer_name ?? p.status.replace(/_/g, " ") });
  }
  for (const inv of invoicesRes.data ?? []) {
    const vn = inv.vendor_id ? vendorName.get(inv.vendor_id) : undefined;
    const label = vn
      ? `${vn} — ${inv.invoice_number ? `INV ${inv.invoice_number}` : inv.title}`
      : inv.title;
    const amount = inv.total_amount != null ? `$${Number(inv.total_amount).toLocaleString()}` : null;
    results.push({
      type: "invoice",
      id: inv.id,
      label,
      sublabel: [amount, inv.status.replace(/_/g, " ")].filter(Boolean).join(" · ") || null,
    });
  }
  for (const c of clientsRes.data ?? []) {
    const label = c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Client";
    results.push({ type: "client", id: c.id, label, sublabel: "Client" });
  }

  return results;
}
