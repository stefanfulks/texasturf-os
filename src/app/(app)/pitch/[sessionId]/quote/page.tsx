import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TURF_PRODUCTS } from "@/lib/pricing/data";
import { QuoteBuilder } from "./quote-builder";
import type { PitchArea, PitchAddon } from "@/lib/db-helpers.types";

export default async function QuotePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: session } = await supabase
    .from("pitch_sessions")
    .select("id, prospect_name, address, status")
    .eq("id", sessionId)
    .single();
  if (!session) notFound();

  const [{ data: areas }, { data: addons }] = await Promise.all([
    supabase.from("pitch_areas").select("*").eq("session_id", sessionId).order("sort", { ascending: true }),
    supabase.from("pitch_addons").select("*").eq("session_id", sessionId).order("sort", { ascending: true }),
  ]);

  // Keys only — product COGS (in TURF_PRODUCTS values) never reaches the client.
  const productOptions = Object.keys(TURF_PRODUCTS);

  return (
    <QuoteBuilder
      session={{ id: session.id, prospectName: session.prospect_name, address: session.address }}
      areas={(areas ?? []) as PitchArea[]}
      addons={(addons ?? []) as PitchAddon[]}
      productOptions={productOptions}
    />
  );
}
