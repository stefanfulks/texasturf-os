import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs when uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

  // Delete source map files after uploading to Sentry (keeps them out of client bundles)
  sourcemaps: {
    filesToDeleteAfterUpload: ["**/*.js.map"],
  },

  webpack: {
    // Tree-shake Sentry debug logging statements out of bundles
    treeshake: { removeDebugLogging: true },
    // Auto-instrument Vercel Cron Monitors
    automaticVercelMonitors: true,
  },
});
