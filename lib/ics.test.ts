import assert from "node:assert/strict";
import test from "node:test";
import { gamesCalendar, googleCalendarEventUrl } from "./ics.ts";
import type { GameSummary } from "./types.ts";

const game = {
  id: "g1",
  status: "scheduled",
  isHome: true,
  startsAt: "2026-11-28T10:00:00.000Z",
  location: "Morrison Gym, Taichung; Court 2",
  teamScore: 0,
  opponentScore: 0,
  team: { gender: "boys", level: "varsity" },
  opponent: { shortName: "Tigers", name: "Taipei Tigers" },
} as unknown as GameSummary;

test("a game becomes a 90-minute event in UTC with escaped text", () => {
  const ics = gamesCalendar([game], { siteUrl: "https://example.test", name: "Broncos", now: Date.parse("2026-11-21T00:00:00Z") });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261128T100000Z\r\n/);
  assert.match(ics, /DTEND:20261128T113000Z\r\n/);
  assert.match(ics, /SUMMARY:Boys Varsity: Broncos vs Tigers\r\n/);
  assert.match(ics, /LOCATION:Morrison Gym\\, Taichung\; Court 2\r\n/);
  assert.match(ics, /UID:game-g1@mat-athletics\r\n/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("long lines are folded to 75 octets", () => {
  const long = { ...game, location: "A".repeat(200) } as GameSummary;
  const ics = gamesCalendar([long], { siteUrl: "https://example.test", name: "Broncos" });
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test("finals carry the score and cancellations are marked", () => {
  const final = { ...game, status: "final", teamScore: 51, opponentScore: 52 } as GameSummary;
  const canceled = { ...game, id: "g2", status: "canceled" } as GameSummary;
  const ics = gamesCalendar([final, canceled], { siteUrl: "https://example.test", name: "Broncos" });
  assert.match(ics, /SUMMARY:Boys Varsity: Broncos vs Tigers \(51–52\)/);
  assert.match(ics, /STATUS:CANCELLED/);
});

test("the Google Calendar link carries the time window", () => {
  const url = new URL(googleCalendarEventUrl(game, "https://example.test"));
  assert.equal(url.searchParams.get("dates"), "20261128T100000Z/20261128T113000Z");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
});
