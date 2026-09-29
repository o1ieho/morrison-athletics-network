export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Demo mode runs the whole site on built-in sample data with no database:
 * public pages read data/seed/demo.json and the operator console saves to the
 * browser. It turns on when NEXT_PUBLIC_SSN_DEMO=1 or Supabase isn't
 * configured, and every page shows a banner while it's on.
 */
export const isDemoMode = process.env.NEXT_PUBLIC_SSN_DEMO === "1" || !supabaseUrl || !supabaseKey;

export const SCHOOL_NAME = "Morrison Academy Taipei";
export const TEAM_NAME = "Broncos";
export const SCHOOL_TIME_ZONE = "Asia/Taipei";
