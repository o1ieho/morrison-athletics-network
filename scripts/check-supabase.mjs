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
    if (count === null) throw new Error("table not found (has the migration been run?)");
    return `${count} rows`;
  });
}

// Security: everything an anonymous visitor (anyone with the public key) might try.
await check("Anonymous visitors can't add opponents", async () => {
  const { error } = await db.from("opponents").insert({ id: "__check__", name: "x", short_name: "x" });
  if (!error) {
    await db.from("opponents").delete().eq("id", "__check__");
    throw new Error("an anonymous visitor could insert rows. Check the RLS policies!");
  }
});

await check("Anonymous visitors can't log plays", async () => {
  const { data: game } = await db.from("games").select("id").limit(1).maybeSingle();
  if (!game) return "skipped (no games yet)";
  const { error } = await db.from("game_events").insert({ game_id: game.id, side: "opponent", event_type: "fg3_made" });
  if (!error) throw new Error("an anonymous visitor logged a play!");
});

await check("Anonymous visitors can't change scores or the clock", async () => {
  const { data: game } = await db.from("games").select("id, team_score").limit(1).maybeSingle();
  if (!game) return "skipped (no games yet)";
  const { data: changed } = await db.from("games").update({ team_score: 999 }).eq("id", game.id).select();
  if (changed?.length) throw new Error("an anonymous visitor changed a score!");
  const { error } = await db.rpc("clock_start", { p_game_id: game.id });
  if (!error) throw new Error("an anonymous visitor started the clock!");
});

await check("Staff roles are private", async () => {
  const { data, error } = await db.from("user_roles").select("*");
  if (error) return `blocked (${error.code})`;
  if (data.length) throw new Error("anonymous visitors can see staff accounts!");
});

process.exit(failed ? 1 : 0);
