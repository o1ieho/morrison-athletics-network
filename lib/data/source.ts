import type {
  Announcement,
  GameEvent,
  GameSummary,
  RosterPlayer,
  Season,
  SeasonStatLine,
  StatLine,
  Team,
  TeamRecord,
} from "@/lib/types";

/** Everything public pages read. Implemented by Supabase and by demo mode. */
export interface DataSource {
  getSeason(): Promise<Season>;
  getTeams(): Promise<Team[]>;
  /** Roster for the active season; all teams when teamId is omitted. */
  getRoster(teamId?: string): Promise<RosterPlayer[]>;
  /** Games for the active season, oldest first. */
  getGames(options?: { teamId?: string }): Promise<GameSummary[]>;
  getGame(id: string): Promise<GameSummary | null>;
  /** All events for a game, including voided ones (callers filter). */
  getGameEvents(gameId: string): Promise<GameEvent[]>;
  getSeasonStats(teamId?: string): Promise<SeasonStatLine[]>;
  getPlayerGameLog(athleteId: string): Promise<Array<{ gameId: string; line: StatLine }>>;
  getTeamRecords(): Promise<TeamRecord[]>;
  getAnnouncements(): Promise<Announcement[]>;
}

export class DataError extends Error {
  constructor(what: string, cause: { message: string } | null) {
    super(`Could not load ${what}${cause ? `: ${cause.message}` : ""}`);
    this.name = "DataError";
  }
}
