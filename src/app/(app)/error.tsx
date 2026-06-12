"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Per-route-group error boundary for the (app) tree.
 *
 * Without this, any client-thrown error inside /tasks, /invoices, /operations,
 * etc., bubbles all the way to global-error.tsx and blows away the whole shell
 * (nav, notifications, Turfy launcher). With it, we keep the shell and just
 * replace the page content with a friendlier fallback. Also gives us a place
 * to attach captureException with the route in scope.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "(app)" },
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-ink-2">Something went wrong on this page.</p>
        <p className="mt-2 text-xs text-ink-3">
          The error has been reported. You can try again or head back to the dashboard.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:bg-hover"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
