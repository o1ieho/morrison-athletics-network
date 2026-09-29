import { createClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "@/lib/config";
import { mapAnnouncement, mapEvent, mapGame, mapOpponent, mapRosterRow, mapSeasonStatLine, mapStatLine, mapTeam } from "@/lib/mappers";
import type { GameSummary, Season } from "@/lib/types";
import { DataError, type DataSource } from "./source";

// Public pages read as the anonymous role; no session cookies are involved,
// so these reads are identical for every visitor.
function client() {
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const GAME_SELECT = "*, team:teams!games_team_id_fkey(*), opponent:opponents!games_opponent_id_fkey(*)";

function mapGameSummary(row: Record<string, unknown>): GameSummary {
  return {
    ...mapGame(row),
    team: mapTeam(row.team as Record<string, unknown>),
    opponent: mapOpponent(row.opponent as Record<string, unknown>),
  };
}

export function createSupabaseSource(): DataSource {
  const db = client();
  let seasonPromise: Promise<Season> | null = null;

  const source: DataSource = {
    getSeason() {
      seasonPromise ??= (async () => {
        const { data, error } = await db.from("seasons").select("id, name").eq("is_active", true).maybeSingle();
        if (error) throw new DataError("the active season", error);
        if (!data) throw new DataError("the active season", { message: "no season is marked active" });
        return { id: data.id, name: data.name };
      })();
      return seasonPromise;
    },

    async getTeams() {
      const { data, error } = await db.from("teams").select("*").order("level", { ascending: false }).order("gender");
      if (error) throw new DataError("teams", error);
      return data.map(mapTeam);
    },

    async getRoster(teamId) {
      const season = await source.getSeason();
      let query = db
        .from("athlete_seasons")
        .select("*, athletes(id, slug, full_name)")
        .eq("season_id", season.id)
        .order("jersey_number", { ascending: true, nullsFirst: false });
      if (teamId) query = query.eq("team_id", teamId);
      const { data, error } = await query;
      if (error) throw new DataError("the roster", error);
      return data.map(mapRosterRow);
    },

    async getGames(options) {
      const season = await source.getSeason();
      let query = db.from("games").select(GAME_SELECT).eq("season_id", season.id).order("starts_at");
      if (options?.teamId) query = query.eq("team_id", options.teamId);
      const { data, error } = await query;
      if (error) throw new DataError("games", error);
      return data.map(mapGameSummary);
    },

    async getGame(id) {
      const { data, error } = await db.from("games").select(GAME_SELECT).eq("id", id).maybeSingle();
      if (error) throw new DataError("the game", error);
      return data ? mapGameSummary(data) : null;
    },

    async getGameEvents(gameId) {
      // A basketball game is a few hundred events, well under the API's row cap.
      const { data, error } = await db.from("game_events").select("*").eq("game_id", gameId).order("created_at").limit(2000);
      if (error) throw new DataError("play-by-play", error);
      return data.map(mapEvent);
    },

    async getSeasonStats(teamId) {
      const season = await source.getSeason();
      let query = db.from("player_season_stats").select("*").eq("season_id", season.id);
      if (teamId) query = query.eq("team_id", teamId);
      const { data, error } = await query;
      if (error) throw new DataError("season stats", error);
      return data.map(mapSeasonStatLine);
    },

    async getPlayerGameLog(athleteId) {
      const { data, error } = await db.from("player_game_stats").select("*").eq("athlete_id", athleteId);
      if (error) throw new DataError("the game log", error);
      return data.map((row) => ({ gameId: String(row.game_id), line: mapStatLine(row) }));
    },

    async getTeamRecords() {
      const season = await source.getSeason();
      const { data, error } = await db.from("team_records").select("*").eq("season_id", season.id);
      if (error) throw new DataError("team records", error);
      return data.map((row) => ({ teamId: row.team_id, wins: row.wins, losses: row.losses, ties: row.ties }));
    },

    async getAnnouncements() {
      const { data, error } = await db
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false });
      if (error) throw new DataError("announcements", error);
      return data.map(mapAnnouncement);
    },
  };

  return source;
}
