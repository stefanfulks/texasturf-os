"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";

/**
 * Ties the signed-in user to Sentry + PostHog so errors and analytics
 * events are attributable. Mounted once per session from (app)/layout.tsx
 * with the already-resolved profile fields.
 *
 * Without this, Sentry issues show as anonymous and PostHog only sees
 * device-level $pageview events.
 */
export function AnalyticsIdentify({
  userId,
  email,
  role,
}: {
  userId: string;
  email: string;
  role: string | null;
}) {
  useEffect(() => {
    Sentry.setUser({ id: userId, email });
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.identify(userId, { email, role: role ?? "unknown" });
    }
  }, [userId, email, role]);

  return null;
}
