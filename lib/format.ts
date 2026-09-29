import { SCHOOL_TIME_ZONE } from "./config";
import type { GameSummary, Team } from "./types";

// All dates render in Taipei time regardless of where the server runs (Vercel
// runs in UTC) or where a visitor's phone is set.

const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: SCHOOL_TIME_ZONE, weekday: "short", month: "short", day: "numeric" });
const shortDayFormat = new Intl.DateTimeFormat("en-US", { timeZone: SCHOOL_TIME_ZONE, month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: SCHOOL_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

export function formatDay(iso: string) {
  return dayFormat.format(new Date(iso));
}

export function formatShortDay(iso: string) {
  return shortDayFormat.format(new Date(iso));
}

export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return `${formatDay(iso)} · ${formatTime(iso)}`;
}

/** YYYY-MM-DD in Taipei, for grouping and <input type="date">. */
export function dateKey(iso: string | Date) {
  return keyFormat.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Converts a Taipei-local "YYYY-MM-DDTHH:mm" (from a datetime-local input) to an ISO timestamp. */
export function taipeiLocalToIso(local: string) {
  // Taiwan has no daylight saving time, so the offset is always +08:00.
  return new Date(`${local}:00+08:00`).toISOString();
}

/** Converts an ISO timestamp to the Taipei-local value a datetime-local input expects. */
export function isoToTaipeiLocal(iso: string) {
  const shifted = new Date(Date.parse(iso) + 8 * 3600 * 1000);
  return shifted.toISOString().slice(0, 16);
}

export function teamLabel(team: Pick<Team, "gender" | "level">) {
  return `${team.level === "jv" ? "JV" : "Varsity"} ${team.gender === "girls" ? "Girls" : "Boys"}`;
}

/** "Broncos vs Tigers" at home, "Broncos at Tigers" away. */
export function matchupLabel(game: Pick<GameSummary, "isHome" | "opponent">, teamName = "Broncos") {
  return game.isHome ? `${teamName} vs ${game.opponent.shortName}` : `${teamName} at ${game.opponent.shortName}`;
}

export function statusLabel(game: Pick<GameSummary, "status">) {
  switch (game.status) {
    case "live":
      return "Live";
    case "final":
      return "Final";
    case "postponed":
      return "Postponed";
    case "canceled":
      return "Canceled";
    default:
      return "Upcoming";
  }
}

export function resultLetter(game: Pick<GameSummary, "status" | "teamScore" | "opponentScore">) {
  if (game.status !== "final") return null;
  if (game.teamScore > game.opponentScore) return "W";
  if (game.teamScore < game.opponentScore) return "L";
  return "T";
}

export function average(total: number, games: number) {
  return games ? (total / games).toFixed(1) : "0.0";
}
