import { connection } from "next/server";
import { isDemoMode } from "@/lib/config";
import { getServerDemoDataset } from "@/lib/demo/dataset";
import { mapAnnouncement, mapGame, mapOpponent, mapRosterRow, mapTeam } from "@/lib/mappers";
import { createSessionClient } from "@/lib/supabase/server";
import type { Announcement, GameSummary, Opponent, RosterPlayer, Team } from "@/lib/types";

export type AdminData = {
  teams: Team[];
  opponents: Opponent[];
  games: GameSummary[];
  roster: RosterPlayer[];
  announcements: Announcement[];
};

/** Everything the admin screens show, read as the signed-in admin (so drafts are included). */
export async function getAdminData(): Promise<AdminData> {
  await connection();

  if (isDemoMode) {
    const demo = getServerDemoDataset();
    return {
      teams: demo.teams,
      opponents: demo.opponents,
      games: demo.games
        .map((game) => ({
          ...game,
          team: demo.teams.find((team) => team.id === game.teamId)!,
          opponent: demo.opponents.find((opponent) => opponent.id === game.opponentId)!,
        }))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      roster: demo.roster,
      announcements: [],
    };
  }

  const db = await createSessionClient();
  const { data: season, error: seasonError } = await db.from("seasons").select("id").eq("is_active", true).maybeSingle();
  if (seasonError) throw new Error(`Could not load the season: ${seasonError.message}`);
  const seasonId = season?.id ?? "";

  const [teams, opponents, games, roster, announcements] = await Promise.all([
    db.from("teams").select("*").order("level", { ascending: false }).order("gender"),
    db.from("opponents").select("*").order("name"),
    db
      .from("games")
      .select("*, team:teams!games_team_id_fkey(*), opponent:opponents!games_opponent_id_fkey(*)")
      .eq("season_id", seasonId)
      .order("starts_at"),
    db
      .from("athlete_seasons")
      .select("*, athletes(id, slug, full_name)")
      .eq("season_id", seasonId)
      .order("jersey_number", { ascending: true, nullsFirst: false }),
    db.from("announcements").select("*").order("created_at", { ascending: false }),
  ]);
  for (const [what, result] of Object.entries({ teams, opponents, games, roster, announcements })) {
    if (result.error) throw new Error(`Could not load ${what}: ${result.error.message}`);
  }

  return {
    teams: teams.data!.map(mapTeam),
    opponents: opponents.data!.map(mapOpponent),
    games: games.data!.map((row) => ({ ...mapGame(row), team: mapTeam(row.team), opponent: mapOpponent(row.opponent) })),
    roster: roster.data!.map(mapRosterRow),
    announcements: announcements.data!.map(mapAnnouncement),
  };
}
