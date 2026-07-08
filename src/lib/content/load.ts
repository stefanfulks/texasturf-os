/**
 * Content loader — server-only. Reads override rows from content_blocks and
 * merges them over the in-code registry defaults. React `cache()` dedupes the
 * query per request, so any number of components can call getContent() and the
 * DB is hit once.
 */
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { CONTENT_BY_KEY } from "./registry";

export type ContentMap = {
  /** DB override if present, else the registry default, else "". */
  get: (key: string) => string;
};

export const getContent = cache(async (): Promise<ContentMap> => {
  const supabase = await createClient();
  const { data } = await supabase.from("content_blocks").select("key, value");
  const overrides = new Map<string, string>((data ?? []).map((r) => [r.key, r.value]));
  return {
    get(key: string) {
      return overrides.get(key) ?? CONTENT_BY_KEY.get(key)?.default ?? "";
    },
  };
});

/** Terse accessor for use in JSX: text(cm, "the.key"). */
export function text(cm: ContentMap, key: string): string {
  return cm.get(key);
}
