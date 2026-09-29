import { cache } from "react";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/config";
import { createDemoSource } from "./demo";
import type { DataSource } from "./source";
import { createSupabaseSource } from "./supabase";

export { DataError } from "./source";

/**
 * The data source for the current request. Awaiting connection() keeps pages
 * that read data out of build-time prerendering, so scores are never frozen
 * at deploy time. cache() shares one source (and its season lookup) per request.
 */
export const getData = cache(async (): Promise<DataSource> => {
  await connection();
  return isDemoMode ? createDemoSource() : createSupabaseSource();
});
