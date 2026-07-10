/**
 * Outbound writes: OS → Jobber.
 *
 * Jobber stays the system of record; the OS pushes its activity back as
 * notes so the office sees OS-side progress without leaving Jobber. Notes
 * go on the CLIENT because the connected token carries write_clients but
 * not write_jobs (scopes verified live 2026-07-10) — clientCreateNote(
 * clientId: EncodedId!, input: ClientCreateNoteInput!) confirmed via
 * introspection on version 2026-04-22.
 *
 * Best-effort by contract: callers fire-and-forget, failures land in
 * Sentry, and a scope/permission failure must never break the OS-side
 * action that triggered the push.
 */

import * as Sentry from "@sentry/nextjs";
import { jobberClient, jobberQuery } from "./graphql";
import { getJobberAccountId } from "./quotes";

const CREATE_CLIENT_NOTE = `
  mutation OsClientNote($clientId: EncodedId!, $input: ClientCreateNoteInput!) {
    clientCreateNote(clientId: $clientId, input: $input) {
      clientNote { id }
      userErrors { message }
    }
  }`;

export async function pushClientNote(
  jobberClientId: string,
  message: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const accountId = await getJobberAccountId();
    if (!accountId) return { ok: false, error: "no connected Jobber account" };

    const client = await jobberClient(accountId);
    const data = await jobberQuery<{
      clientCreateNote: {
        clientNote: { id: string } | null;
        userErrors: { message: string }[];
      };
    }>(client, CREATE_CLIENT_NOTE, {
      clientId: jobberClientId,
      input: { message },
    });

    const errs = data.clientCreateNote?.userErrors ?? [];
    if (errs.length || !data.clientCreateNote?.clientNote) {
      const error = errs.map((e) => e.message).join("; ") || "no note returned";
      Sentry.captureMessage(`Jobber client-note push failed: ${error}`, {
        level: "warning",
        tags: { jobber: "push" },
      });
      return { ok: false, error };
    }
    return { ok: true, error: null };
  } catch (err) {
    Sentry.captureException(err, { tags: { jobber: "push" } });
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
