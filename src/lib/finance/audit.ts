import { createClient } from "@/lib/supabase/server";

export async function logFinChange(args: {
  table: string;
  rowId?: string | null;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("fin_change_log").insert({
    table_name: args.table,
    row_id: args.rowId ?? null,
    field: args.field ?? null,
    old_value: args.oldValue == null ? null : String(args.oldValue),
    new_value: args.newValue == null ? null : String(args.newValue),
    changed_by: user?.id ?? null,
    reason: args.reason ?? null,
  });
}
