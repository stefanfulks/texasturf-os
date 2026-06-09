/**
 * Turfy write-tool commit endpoint.
 *
 * The chat client POSTs here when the user clicks Confirm on a draft card.
 * We re-validate the draft against the Zod schemas in `lib/assistant/drafts`
 * (the client could tamper with the payload — the schema is the source of
 * truth) and dispatch to the real server action.
 *
 * Auth: signed-in user only. The dispatched server actions use the
 * user-context Supabase client, so RLS applies — the user can only create
 * things they're already allowed to create.
 */

import { createClient } from "@/lib/supabase/server";
import { DraftSchema, type Draft } from "@/lib/assistant/drafts";
import { createTask } from "@/app/(app)/tasks/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuccessBody = {
  ok: true;
  summary: string;
  view_url: string | null;
  created_id: string | null;
};

type ErrorBody = {
  ok: false;
  error: string;
};

export async function POST(request: Request): Promise<Response> {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json(
      { ok: false, error: "Not authenticated" } satisfies ErrorBody,
      { status: 401 },
    );
  }

  // Body
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return Response.json(
      { ok: false, error: "Invalid request body" } satisfies ErrorBody,
      { status: 400 },
    );
  }

  // Validate the draft shape. The client may have round-tripped the draft
  // through the browser, so anything could be in `raw` — re-parse strictly.
  const parsed = DraftSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error:
          "Invalid draft: " +
          parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "),
      } satisfies ErrorBody,
      { status: 400 },
    );
  }
  const draft: Draft = parsed.data;

  // Dispatch
  switch (draft.kind) {
    case "task": {
      const fd = new FormData();
      fd.append("title", draft.title);
      if (draft.description) fd.append("description", draft.description);
      fd.append("priority", draft.priority);
      fd.append("status", "inbox");
      if (draft.due_date) fd.append("due_date", draft.due_date);
      if (draft.assignee_id) fd.append("assignee_ids", draft.assignee_id);
      // Don't pass project_id — Turfy doesn't propose a project assignment
      // in v1; user can reassign in the Tasks UI.

      const result = await createTask(fd);
      if (result.error || !result.task) {
        return Response.json(
          { ok: false, error: result.error ?? "Failed to create task" } satisfies ErrorBody,
          { status: 500 },
        );
      }

      return Response.json({
        ok:         true,
        summary:    `Created — ${draft.title}`,
        view_url:   `/tasks/${result.task.id}`,
        created_id: result.task.id,
      } satisfies SuccessBody);
    }

    default: {
      // Exhaustiveness check. If a new draft kind is added to DraftSchema
      // without a case here, TypeScript will flag this assignment.
      const _exhaustive: never = draft.kind;
      void _exhaustive;
      return Response.json(
        { ok: false, error: `Unsupported draft kind: ${(draft as Draft).kind}` } satisfies ErrorBody,
        { status: 400 },
      );
    }
  }
}
