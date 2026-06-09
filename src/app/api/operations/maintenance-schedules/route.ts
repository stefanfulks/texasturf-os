/**
 * GET /api/operations/maintenance-schedules?asset_id=<uuid>
 *
 * Returns the active maintenance schedules for a given asset. Powers the
 * dependent select on /operations/vehicles/new — picking an asset there
 * triggers a fetch to populate the schedule dropdown.
 *
 * Auth: requires a signed-in user (any role). Reads use the SSR client so
 * RLS applies normally.
 */

import { NextRequest, NextResponse } from "next/server";
import { listMaintenanceSchedulesForAsset } from "@/lib/warehouse/queries";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const assetId = new URL(req.url).searchParams.get("asset_id");
  if (!assetId) return NextResponse.json({ schedules: [] });

  try {
    const schedules = await listMaintenanceSchedulesForAsset(assetId);
    return NextResponse.json({ schedules });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
