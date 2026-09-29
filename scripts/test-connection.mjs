// Quick connection test — run with: node scripts/test-connection.mjs
import { createClient } from "@supabase/supabase-js";

const url = "https://wbhzlxwmogrllfenurgw.supabase.co";
const key = "sb_publishable_k7hC1tGETUBNBcNVzpsJXQ_WINl59ed";

const supabase = createClient(url, key);

async function test() {
  console.log("Testing Supabase connection...\n");

  // Test 1: Can we reach Supabase at all?
  const { data: teams, error: teamsErr } = await supabase.from("teams").select("*").limit(3);
  if (teamsErr) {
    console.error("❌ teams query failed:", teamsErr.message);
  } else {
    console.log(`✅ teams: ${teams.length} rows`, teams.map(t => t.name));
  }

  const { data: athletes, error: athErr } = await supabase.from("athletes").select("*").limit(3);
  if (athErr) {
    console.error("❌ athletes query failed:", athErr.message);
  } else {
    console.log(`✅ athletes: ${athletes.length} rows`, athletes.map(a => a.full_name));
  }

  const { data: games, error: gamesErr } = await supabase.from("games").select("*").limit(3);
  if (gamesErr) {
    console.error("❌ games query failed:", gamesErr.message);
  } else {
    console.log(`✅ games: ${games.length} rows`, games.map(g => g.id));
  }

  const { data: announcements, error: annErr } = await supabase.from("announcements").select("*").limit(3);
  if (annErr) {
    console.error("❌ announcements query failed:", annErr.message);
  } else {
    console.log(`✅ announcements: ${announcements.length} rows`, announcements.map(a => a.title));
  }

  const { data: seasons, error: seasErr } = await supabase.from("seasons").select("*").limit(1);
  if (seasErr) {
    console.error("❌ seasons query failed:", seasErr.message);
  } else {
    console.log(`✅ seasons: ${seasons.length} rows`, seasons);
  }

  const { data: events, error: evErr } = await supabase.from("game_events").select("*").limit(3);
  if (evErr) {
    console.error("❌ game_events query failed:", evErr.message);
  } else {
    console.log(`✅ game_events: ${events.length} rows`);
  }

  const { data: sports, error: spErr } = await supabase.from("sports").select("*");
  if (spErr) {
    console.error("❌ sports query failed:", spErr.message);
  } else {
    console.log(`✅ sports: ${sports.length} rows`, sports);
  }

  const { data: athleteSeasons, error: asErr } = await supabase.from("athlete_seasons").select("*").limit(3);
  if (asErr) {
    console.error("❌ athlete_seasons query failed:", asErr.message);
  } else {
    console.log(`✅ athlete_seasons: ${athleteSeasons.length} rows`);
  }

  console.log("\nDone.");
}

test();
