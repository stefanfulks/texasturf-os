"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateReservationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; id: string };

function localToUtcIso(value: string): string {
  // datetime-local gives "2026-06-05T09:00" with no zone. Treat it as the
  // user's local time and convert to UTC ISO for the column.
  return new Date(value).toISOString();
}

export async function createReservation(
  _prev: CreateReservationState,
  formData: FormData,
): Promise<CreateReservationState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const assetId = (formData.get("asset_id") as string | null)?.trim();
  const driverId = (formData.get("driver_id") as string | null)?.trim() || user.id;
  const startsRaw = formData.get("starts_at") as string | null;
  const endsRaw = formData.get("ends_at") as string | null;
  const purpose = (formData.get("purpose") as string | null)?.trim();
  const destination = (formData.get("destination") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!assetId || !startsRaw || !endsRaw || !purpose) {
    return { status: "error", message: "Vehicle, start, end and purpose are required." };
  }

  const startsAt = localToUtcIso(startsRaw);
  const endsAt = localToUtcIso(endsRaw);

  if (new Date(endsAt) <= new Date(startsAt)) {
    return { status: "error", message: "End time has to be after the start time." };
  }

  // Conflict check — any other active reservation for the same vehicle that
  // overlaps the requested window. (starts_a < ends_b) AND (ends_a > starts_b).
  const { data: conflicts } = await supabase
    .from("vehicle_reservations")
    .select("id, starts_at, ends_at, driver_id")
    .eq("asset_id", assetId)
    .eq("status", "active")
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt);

  if (conflicts && conflicts.length > 0) {
    return {
      status: "error",
      message: `This vehicle is already booked during that window (${conflicts.length} overlapping reservation${conflicts.length === 1 ? "" : "s"}). Pick a different time or vehicle.`,
    };
  }

  // The vehicle_reservations table isn't yet in the generated Database types,
  // so we cast through unknown to bypass strict checks. Once the types are
  // regenerated post-migration we can drop these casts.
  const insertPayload = {
    asset_id: assetId,
    driver_id: driverId,
    starts_at: startsAt,
    ends_at: endsAt,
    purpose,
    destination,
    notes,
    created_by: user.id,
  };
  const { data, error } = await (
    supabase.from("vehicle_reservations") as unknown as {
      insert: (row: typeof insertPayload) => {
        select: (cols: string) => {
          single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    }
  )
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Failed to save reservation." };
  }

  revalidatePath("/fleet/reservations");
  revalidatePath("/fleet");
  return { status: "success", id: data.id };
}

export async function cancelReservation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  await (
    supabase.from("vehicle_reservations") as unknown as {
      update: (row: { status: string }) => { eq: (col: string, val: string) => Promise<unknown> };
    }
  )
    .update({ status: "cancelled" })
    .eq("id", id);

  revalidatePath("/fleet/reservations");
}
