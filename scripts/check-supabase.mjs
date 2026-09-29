// Checks that the configured Supabase project is reachable and set up.
// Run: npm run check:supabase   (reads .env.local)

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local first.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
let failed = false;

async function check(label, run) {
  try {
    const detail = await run();
    console.log(`✓ ${label}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    failed = true;
    console.log(`✗ ${label}: ${error.message}`);
  }
}

await check("Reach the project", async () => {
  const { error } = await db.rpc("server_time");
  if (error) throw new Error(`${error.message} (has the migration been run?)`);
});

await check("Active season", async () => {
  const { data, error } = await db.from("seasons").select("id, name").eq("is_active", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("none marked active (run supabase/seed.sql)");
  return data.name;
});

for (const table of ["teams", "athlete_seasons", "opponents", "games"]) {
  await check(`Read ${table}`, async () => {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw error;
    return `${count} rows`;
  });
}

await check("Anonymous writes are blocked", async () => {
  const { error } = await db.from("opponents").insert({ id: "__check__", name: "x", short_name: "x" });
  if (!error) {
    await db.from("opponents").delete().eq("id", "__check__");
    throw new Error("an anonymous visitor could insert rows. Check the RLS policies!");
  }
});

process.exit(failed ? 1 : 0);
