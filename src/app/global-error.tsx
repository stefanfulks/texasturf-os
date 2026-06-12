"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-hover p-8">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-ink-3">Something went wrong</p>
          <p className="mt-2 text-xs text-ink-4">
            The error has been reported automatically.
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
