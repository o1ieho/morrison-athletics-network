// Builds iCalendar (.ics) files from our games: a subscribable feed of the
// season and a single-game file for "Add to calendar". Pure functions so they
// can be tested; the routes add the headers.

import type { GameSummary } from "./types";

// Same wording as lib/format's teamLabel and matchupLabel (not imported, so
// this file runs under `node --test` without the app's module aliases).
const teamLabel = (team: GameSummary["team"]) => `${team.gender === "girls" ? "Girls" : "Boys"} ${team.level === "jv" ? "JV" : "Varsity"}`;
const matchupLabel = (game: GameSummary) => `Broncos ${game.isHome ? "vs" : "at"} ${game.opponent.shortName}`;

/** Games are listed as 90 minutes, about how long a high-school game takes. */
const GAME_MINUTES = 90;

function stamp(ms: number) {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapes text per RFC 5545 (backslash, semicolon, comma, newline). */
function text(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines longer than 75 octets, as the spec requires (continuation lines start with a space). */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (size + length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += length;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function gameEventSummary(game: GameSummary) {
  const result = game.status === "final" ? ` (${game.teamScore}–${game.opponentScore})` : "";
  const flag = game.status === "postponed" ? " · Postponed" : game.status === "canceled" ? " · Canceled" : "";
  return `${teamLabel(game.team)}: ${matchupLabel(game)}${result}${flag}`;
}

function vevent(game: GameSummary, siteUrl: string, now: number) {
  const start = Date.parse(game.startsAt);
  const url = `${siteUrl}/games/${encodeURIComponent(game.id)}`;
  return [
    "BEGIN:VEVENT",
    `UID:game-${game.id}@mat-athletics`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start + GAME_MINUTES * 60_000)}`,
    `SUMMARY:${text(gameEventSummary(game))}`,
    game.location ? `LOCATION:${text(game.location)}` : null,
    `DESCRIPTION:${text(`Live scores and stats: ${url}`)}`,
    `URL:${url}`,
    game.status === "canceled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "END:VEVENT",
  ].filter((line): line is string => line !== null);
}

/** A calendar with the given games. `name` shows as the calendar's title when subscribed. */
export function gamesCalendar(games: GameSummary[], { siteUrl, name, now = Date.now() }: { siteUrl: string; name: string; now?: number }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MAT Athletics//Broncos games//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${text(name)}`,
    "X-WR-TIMEZONE:Asia/Taipei",
    // Ask subscribed calendars to check for changes every few hours.
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
    ...games.flatMap((game) => vevent(game, siteUrl, now)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Google Calendar's "add this one event" link. */
export function googleCalendarEventUrl(game: GameSummary, siteUrl: string) {
  const start = Date.parse(game.startsAt);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: gameEventSummary(game),
    dates: `${stamp(start)}/${stamp(start + GAME_MINUTES * 60_000)}`,
    details: `Live scores and stats: ${siteUrl}/games/${game.id}`,
    location: game.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
