/**
 * GraphQL client for the Jobber API. Each call gets a fresh client with a
 * valid access token (transparently refreshed by getAccessToken()).
 *
 * Throttling: Jobber uses a leaky-bucket query-cost limiter. Every response
 * carries the live `extensions.cost.throttleStatus` (max, available, restore
 * rate). `jobberQuery()` reads it and proactively sleeps before the next
 * call when the bucket can't afford the upcoming page — avoids the round
 * trip + retry that would otherwise burn time on a guaranteed THROTTLED.
 *
 * Docs: https://developer.getjobber.com/docs/using_jobbers_api/api_rate_limits
 */

import { GraphQLClient } from "graphql-request";
import { JOBBER } from "./config";
import { getAccessToken } from "./tokens";

export async function jobberClient(accountId: string) {
  const token = await getAccessToken(accountId);
  return new GraphQLClient(JOBBER.graphqlUrl, {
    headers: {
      authorization:             `bearer ${token}`,
      "X-JOBBER-GRAPHQL-VERSION": JOBBER.apiVersion,
    },
  });
}

type ThrottleStatus = {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
};

type JobberExtensions = {
  cost?: {
    requestedQueryCost?: number;
    actualQueryCost?: number;
    throttleStatus?: ThrottleStatus;
  };
};

// Module-level state per process. A serverless cold start resets it, which is
// fine — the first call to a fresh instance just runs without prior info,
// and on THROTTLED we fall back to retry-with-wait.
let lastCost = 0;
let lastThrottle: ThrottleStatus | null = null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function waitFor(needed: number): number {
  if (!lastThrottle) return 0;
  const { currentlyAvailable, restoreRate } = lastThrottle;
  if (currentlyAvailable >= needed) return 0;
  const deficit = needed - currentlyAvailable;
  // +250ms buffer to absorb clock skew and the request's own travel time.
  return Math.ceil((deficit / restoreRate) * 1000) + 250;
}

/**
 * Run a query with adaptive throttle-aware pacing.
 *
 * - Sleeps proactively if the previous response showed the bucket can't
 *   afford the next expected cost.
 * - On a THROTTLED error from Jobber, sleeps until the bucket is full and
 *   retries (one extra time only — beyond that the caller should see the
 *   error so we don't mask a different bug).
 */
export async function jobberQuery<T>(
  client: GraphQLClient,
  query: string,
  // graphql-request types variables as a generic record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables?: Record<string, any>,
): Promise<T> {
  // Pace based on prior page's cost as the estimate for this one.
  if (lastCost > 0) {
    const ms = waitFor(lastCost);
    if (ms > 0) await sleep(ms);
  }

  try {
    const res = await client.rawRequest<T, Record<string, unknown>>(
      query,
      variables as Record<string, unknown>,
    );
    const ext = res.extensions as JobberExtensions | undefined;
    if (ext?.cost) {
      if (typeof ext.cost.requestedQueryCost === "number") {
        lastCost = ext.cost.requestedQueryCost;
      }
      if (ext.cost.throttleStatus) lastThrottle = ext.cost.throttleStatus;
    }
    return res.data;
  } catch (err: unknown) {
    // graphql-request throws ClientError on GraphQL errors; the response
    // (including extensions with the cost+throttle telemetry) is on the
    // thrown object. Use it to back off and retry once.
    const e = err as {
      response?: {
        errors?: { extensions?: { code?: string } }[];
        extensions?: JobberExtensions;
      };
    };
    const throttled = e.response?.errors?.some(
      (x) => x.extensions?.code === "THROTTLED",
    );
    const status = e.response?.extensions?.cost?.throttleStatus;
    if (throttled && status) {
      lastThrottle = status;
      // Wait for a full bucket — covers worst case for the retried request.
      const ms = waitFor(status.maximumAvailable);
      await sleep(ms);
      const res = await client.rawRequest<T, Record<string, unknown>>(
        query,
        variables as Record<string, unknown>,
      );
      const ext = res.extensions as JobberExtensions | undefined;
      if (ext?.cost) {
        if (typeof ext.cost.requestedQueryCost === "number") {
          lastCost = ext.cost.requestedQueryCost;
        }
        if (ext.cost.throttleStatus) lastThrottle = ext.cost.throttleStatus;
      }
      return res.data;
    }
    throw err;
  }
}
