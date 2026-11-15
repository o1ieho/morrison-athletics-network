"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "@/lib/config";

let client: SupabaseClient | null = null;

/** How long a database request may hang before it is given up and retried. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * fetch with a timeout for database calls. On weak gym Wi-Fi a request can
 * hang for a minute; plays are sent one at a time, so one stuck request would
 * hold up every play behind it and freeze the clock buttons. Timing out lets
 * the queue retry instead. Uploads and sign-in are left alone.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes("/rest/v1/")) return fetch(input, init);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("The request timed out", "TimeoutError")), REQUEST_TIMEOUT_MS);
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason);
    else outer.addEventListener("abort", () => controller.abort(outer.reason), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

/** One shared browser client, so realtime channels and the session are reused. */
export function getBrowserClient(): SupabaseClient {
  client ??= createBrowserClient(supabaseUrl, supabaseKey, { global: { fetch: fetchWithTimeout } });
  return client;
}
