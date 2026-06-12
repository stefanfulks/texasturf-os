"use client";

import { useActionState } from "react";
import { createCalendarEvent, type CreateEventState } from "../actions";

const initialState: CreateEventState = { status: "idle" };

function defaultStartIso(): string {
  // Default: tomorrow at 9am local time, formatted for datetime-local input
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function defaultEndIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export function EventForm() {
  const [state, formAction, pending] = useActionState(createCalendarEvent, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-white p-6">
      <label className="block text-sm font-medium text-ink-2">
        Title
        <input
          type="text"
          name="summary"
          required
          className="mt-1 block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm shadow-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          placeholder="Site visit at 123 Main St"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-ink-2">
          Start
          <input
            type="datetime-local"
            name="start"
            required
            defaultValue={defaultStartIso()}
            className="mt-1 block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm shadow-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </label>
        <label className="block text-sm font-medium text-ink-2">
          End
          <input
            type="datetime-local"
            name="end"
            required
            defaultValue={defaultEndIso()}
            className="mt-1 block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm shadow-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-ink-2">
        Location
        <input
          type="text"
          name="location"
          className="mt-1 block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm shadow-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          placeholder="Customer address or place name"
        />
      </label>

      <label className="block text-sm font-medium text-ink-2">
        Description
        <textarea
          name="description"
          rows={4}
          className="mt-1 block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm shadow-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
      </label>

      <label className="block text-sm font-medium text-ink-2">
        Attendees <span className="text-xs text-ink-4">(comma-separated emails)</span>
        <input
          type="text"
          name="attendees"
          className="mt-1 block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm shadow-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          placeholder="colin@texasturfusa.com, allison@texasturfusa.com"
        />
      </label>

      {state.status === "error" && (
        <p className="text-sm text-danger">{state.message}</p>
      )}

      {state.status === "success" && (
        <p className="text-sm text-brand">
          Event created.{" "}
          <a href={state.htmlLink} target="_blank" rel="noopener noreferrer" className="underline">
            View on Google Calendar →
          </a>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="block w-full rounded-md bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}
