/**
 * Jobber quote creation for the Pitch close.
 *
 * On accept, we build the quote IN Jobber (system of record) and hand back its
 * client-hub URL so the client is redirected to Jobber to approve + pay — where
 * Wisestack financing also appears. Schema verified against the live API
 * (version 2026-04-22): quoteCreate(attributes: QuoteCreateAttributes!) needs
 * clientId + propertyId + lineItems, takes an optional percentage deposit, and
 * the returned Quote exposes clientHubUri.
 *
 * NOTE: requires the Jobber app to have Quotes (write) enabled in the Jobber
 * Developer Center and Payments + Wisestack turned on. Callers treat failures as
 * best-effort and fall back to the manual handoff.
 */

import { jobberClient, jobberQuery } from "./graphql";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** The single connected Jobber account id (most-recently refreshed). */
export async function getJobberAccountId(): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("jobber_oauth_tokens")
    .select("jobber_account_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.jobber_account_id ?? null;
}

/** First property for a Jobber client — quotes are created against a property. */
export async function getClientPropertyId(accountId: string, clientId: string): Promise<string | null> {
  const client = await jobberClient(accountId);
  const query = `query($id: EncodedId!){ client(id: $id){ clientProperties(first: 1){ nodes { id } } } }`;
  const data = await jobberQuery<{ client: { clientProperties: { nodes: { id: string }[] } } | null }>(
    client,
    query,
    { id: clientId },
  );
  return data.client?.clientProperties?.nodes?.[0]?.id ?? null;
}

export type PitchQuoteInput = {
  clientId: string;
  propertyId: string;
  title: string;
  lineName: string;
  total: number;
  depositPct: number;
};

/** Create the quote in Jobber, transitioned to AWAITING_RESPONSE, with a % deposit. */
export async function createPitchQuote(
  accountId: string,
  input: PitchQuoteInput,
): Promise<{ quoteId: string; clientHubUri: string }> {
  const client = await jobberClient(accountId);
  const mutation = `
    mutation CreatePitchQuote($attributes: QuoteCreateAttributes!) {
      quoteCreate(attributes: $attributes) {
        quote { id clientHubUri }
        userErrors { message }
      }
    }`;
  const attributes = {
    clientId: input.clientId,
    propertyId: input.propertyId,
    title: input.title,
    allowClientHubCreditCardPayments: true,
    transitionQuoteTo: "AWAITING_RESPONSE",
    deposit: { rate: input.depositPct, type: "Percent" },
    lineItems: [
      { name: input.lineName, quantity: 1, unitPrice: input.total, saveToProductsAndServices: false },
    ],
  };
  const data = await jobberQuery<{
    quoteCreate: { quote: { id: string; clientHubUri: string } | null; userErrors: { message: string }[] };
  }>(client, mutation, { attributes });

  const errs = data.quoteCreate?.userErrors ?? [];
  const quote = data.quoteCreate?.quote;
  if (errs.length || !quote) {
    throw new Error(errs.map((e) => e.message).join("; ") || "quoteCreate returned no quote");
  }
  return { quoteId: quote.id, clientHubUri: quote.clientHubUri };
}
