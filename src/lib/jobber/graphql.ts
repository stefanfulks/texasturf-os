/**
 * GraphQL client for the Jobber API. Each call gets a fresh client with a
 * valid access token (transparently refreshed by getAccessToken()).
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
