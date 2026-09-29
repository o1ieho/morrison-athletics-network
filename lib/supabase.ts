import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server-side Supabase client.
 * Use this in Server Components and Route Handlers.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Creates a fresh Supabase client for browser usage.
 * Use this in Client Components ("use client").
 */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
