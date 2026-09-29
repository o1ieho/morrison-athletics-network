// Converts raw Supabase rows (snake_case) into app types. Shared by server
// queries and realtime handlers, which receive the same raw row shape.

import type { Announcement, Game, GameEvent, MediaItem, Opponent, RosterPlayer, SeasonStatLine, StatLine, Team } from "./types";

type Row = Record<string, unknown>;

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const strOrNull = (value: unknown) => (value === null || value === undefined ? null : String(value));
const num = (value: unknown) => Number(value ?? 0);
const numOrNull = (value: unknown) => (value === null || value === undefined ? null : Number(value));

export function mapTeam(row: Row): Team {
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    gender: row.gender as Team["gender"],
    level: row.level as Team["level"],
    conference: str(row.conference),
    seasonStatus: (row.season_status as Team["seasonStatus"]) ?? "active",
  };
}

export function mapOpponent(row: Row): Opponent {
  return { id: str(row.id), name: str(row.name), shortName: str(row.short_name) || str(row.name) };
}

export function mapGame(row: Row): Game {
  return {
    id: str(row.id),
    seasonId: str(row.season_id),
    teamId: str(row.team_id),
    opponentId: str(row.opponent_id),
    isHome: Boolean(row.is_home),
    startsAt: str(row.starts_at),
    location: str(row.location),
    status: row.status as Game["status"],
    scoringMode: row.scoring_mode as Game["scoringMode"],
    teamScore: num(row.team_score),
    opponentScore: num(row.opponent_score),
    periodCount: num(row.period_count),
    periodLengthSeconds: num(row.period_length_seconds),
    overtimeLengthSeconds: num(row.overtime_length_seconds),
    foulReset: row.foul_reset as Game["foulReset"],
    bonusThreshold: num(row.bonus_threshold),
    currentPeriod: num(row.current_period),
    clockRunning: Boolean(row.clock_running),
    clockSecondsLeft: num(row.clock_seconds_left),
    clockAnchorAt: strOrNull(row.clock_anchor_at),
    updatedAt: str(row.updated_at),
  };
}

export function mapEvent(row: Row): GameEvent {
  return {
    id: str(row.id),
    gameId: str(row.game_id),
    side: row.side as GameEvent["side"],
    athleteId: strOrNull(row.athlete_id),
    type: row.event_type as GameEvent["type"],
    period: num(row.period),
    clockSecondsLeft: num(row.clock_seconds_left),
    points: num(row.points),
    shotX: numOrNull(row.shot_x),
    shotY: numOrNull(row.shot_y),
    createdAt: str(row.created_at),
    voidedAt: strOrNull(row.voided_at),
  };
}

/** Maps an athlete_seasons row joined with `athletes(...)`. */
export function mapRosterRow(row: Row): RosterPlayer {
  const athlete = (row.athletes ?? {}) as Row;
  return {
    athleteId: str(row.athlete_id ?? athlete.id),
    slug: str(athlete.slug),
    name: str(athlete.full_name),
    teamId: str(row.team_id),
    number: numOrNull(row.jersey_number),
    position: strOrNull(row.position),
    grade: strOrNull(row.grade),
    height: strOrNull(row.height),
  };
}

const STAT_KEYS: Array<keyof StatLine> = ["pts", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "reb", "ast", "stl", "blk", "tov", "pf"];

export function mapStatLine(row: Row): StatLine {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, num(row[key])])) as StatLine;
}

export function mapSeasonStatLine(row: Row): SeasonStatLine {
  return { ...mapStatLine(row), athleteId: str(row.athlete_id), teamId: str(row.team_id), gp: num(row.gp) };
}

export function mapAnnouncement(row: Row): Announcement {
  return {
    id: str(row.id),
    slug: str(row.slug),
    title: str(row.title),
    category: row.category as Announcement["category"],
    summary: str(row.summary),
    body: str(row.body),
    pinned: Boolean(row.pinned),
    publishedAt: strOrNull(row.published_at),
    expiresAt: strOrNull(row.expires_at),
    teamId: strOrNull(row.team_id),
    athleteId: strOrNull(row.athlete_id),
  };
}

export function mapMedia(row: Row): MediaItem {
  return {
    id: str(row.id),
    kind: row.kind === "video" ? "video" : "photo",
    title: str(row.title),
    url: str(row.url),
    thumbnailUrl: strOrNull(row.thumbnail_url),
    width: numOrNull(row.width),
    height: numOrNull(row.height),
    teamId: strOrNull(row.team_id),
    gameId: strOrNull(row.game_id),
    createdAt: str(row.created_at),
  };
}
