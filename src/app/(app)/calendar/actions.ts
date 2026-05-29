"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/lib/google/calendar";

export type CreateEventState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; htmlLink: string };

export async function createCalendarEvent(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;
  const isGoogleUser = session?.user?.app_metadata?.provider === "google";

  if (!isGoogleUser || !providerToken) {
    return {
      status: "error",
      message: "Google Calendar access requires signing in with Google.",
    };
  }

  const summary = (formData.get("summary") as string | null)?.trim();
  const start = formData.get("start") as string | null;
  const end = formData.get("end") as string | null;
  const location = (formData.get("location") as string | null)?.trim() || undefined;
  const description = (formData.get("description") as string | null)?.trim() || undefined;
  const attendeesRaw = (formData.get("attendees") as string | null)?.trim() || "";

  if (!summary || !start || !end) {
    return { status: "error", message: "Title, start, and end are required." };
  }

  const attendees = attendeesRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));

  // datetime-local gives us values like "2026-05-30T09:00" — treat them as
  // local (America/Chicago) and let the API timezone handle the rest.
  // We send them through as ISO with no Z so the API uses our timeZone field.
  const startIso = new Date(start).toISOString();
  const endIso = new Date(end).toISOString();

  try {
    const event = await createEvent(providerToken, {
      summary,
      description,
      location,
      start: startIso,
      end: endIso,
      attendees: attendees.length > 0 ? attendees : undefined,
    });

    return {
      status: "success",
      htmlLink: event.htmlLink,
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to create event.",
    };
  }
}
