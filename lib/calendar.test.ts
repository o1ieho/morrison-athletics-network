import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import { parseCalendar, startMs } from "./calendar.ts";

// A feed shaped like Google Calendar's export: a Taipei timezone block, a
// timed game, a weekly practice with one moved and one cancelled week, an
// all-day tournament, a cancelled event, and a UTC-stamped event.
const FEED = `BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
X-WR-TIMEZONE:Asia/Taipei
BEGIN:VTIMEZONE
TZID:Asia/Taipei
X-LIC-LOCATION:Asia/Taipei
BEGIN:STANDARD
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
TZNAME:CST
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:game-1@google.com
DTSTART;TZID=Asia/Taipei:20261002T170000
DTEND;TZID=Asia/Taipei:20261002T183000
SUMMARY:Varsity Boys vs TAS
LOCATION:Morrison Gym
DESCRIPTION:Bus leaves 4:15\\, wear home whites
END:VEVENT
BEGIN:VEVENT
UID:practice@google.com
DTSTART;TZID=Asia/Taipei:20261001T153000
DTEND;TZID=Asia/Taipei:20261001T170000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=Asia/Taipei:20261015T153000
SUMMARY:JV Girls practice
END:VEVENT
BEGIN:VEVENT
UID:practice@google.com
RECURRENCE-ID;TZID=Asia/Taipei:20261008T153000
DTSTART;TZID=Asia/Taipei:20261008T160000
DTEND;TZID=Asia/Taipei:20261008T173000
SUMMARY:JV Girls practice (moved)
END:VEVENT
BEGIN:VEVENT
UID:tournament@google.com
DTSTART;VALUE=DATE:20261010
DTEND;VALUE=DATE:20261012
SUMMARY:TISSA Tournament
END:VEVENT
BEGIN:VEVENT
UID:cancelled@google.com
DTSTART;TZID=Asia/Taipei:20261003T100000
DTEND;TZID=Asia/Taipei:20261003T110000
STATUS:CANCELLED
SUMMARY:Scrimmage
END:VEVENT
BEGIN:VEVENT
UID:utc@google.com
DTSTART:20261005T093000Z
DTEND:20261005T110000Z
SUMMARY:Varsity Girls at TES
END:VEVENT
END:VCALENDAR
`;

const from = new Date("2026-09-30T00:00:00+08:00");
const to = new Date("2026-11-01T00:00:00+08:00");

test("timed events keep Taipei time", () => {
  const game = parseCalendar(FEED, from, to).find((event) => event.title === "Varsity Boys vs TAS")!;
  assert.equal(game.start, "2026-10-02T09:00:00.000Z"); // 5:00 PM Taipei
  assert.equal(game.allDay, false);
  assert.equal(game.location, "Morrison Gym");
  assert.equal(game.description, "Bus leaves 4:15, wear home whites");
});

test("UTC times convert correctly", () => {
  const away = parseCalendar(FEED, from, to).find((event) => event.title === "Varsity Girls at TES")!;
  assert.equal(away.start, "2026-10-05T09:30:00.000Z");
});

test("repeating events expand, with moved and cancelled weeks", () => {
  const practices = parseCalendar(FEED, from, to).filter((event) => event.title.startsWith("JV Girls practice"));
  assert.deepEqual(
    practices.map((event) => [event.title, event.start]),
    [
      ["JV Girls practice", "2026-10-01T07:30:00.000Z"],
      ["JV Girls practice (moved)", "2026-10-08T08:00:00.000Z"],
      // Oct 15 was cancelled with EXDATE.
      ["JV Girls practice", "2026-10-22T07:30:00.000Z"],
    ],
  );
  assert.equal(new Set(practices.map((event) => event.id)).size, 3, "each occurrence has its own id");
});

test("all-day events keep their date", () => {
  const tournament = parseCalendar(FEED, from, to).find((event) => event.title === "TISSA Tournament")!;
  assert.equal(tournament.allDay, true);
  assert.equal(tournament.start, "2026-10-10");
  assert.equal(tournament.end, "2026-10-12");
});

test("cancelled events are dropped and results are sorted", () => {
  const events = parseCalendar(FEED, from, to);
  assert.ok(!events.some((event) => event.title === "Scrimmage"));
  const starts = events.map(startMs);
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
});

test("only events in the window are returned", () => {
  const events = parseCalendar(FEED, new Date("2026-10-09T00:00:00+08:00"), new Date("2026-10-11T00:00:00+08:00"));
  assert.deepEqual(events.map((event) => event.title), ["TISSA Tournament"]);
});

// A real Google Calendar export, when available (fetched by hand for testing).
const realFeed = "/tmp/claude-501/tw.ics";
test("parses a real Google Calendar feed", { skip: existsSync(realFeed) ? false : "no sample feed" }, () => {
  const events = parseCalendar(readFileSync(realFeed, "utf8"), new Date("2026-01-01"), new Date("2027-01-01"));
  assert.ok(events.length > 10);
  assert.ok(events.every((event) => event.allDay && /^\d{4}-\d{2}-\d{2}$/.test(event.start)));
});

test("times without a known timezone are read as Taipei", () => {
  const feed = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:floating@test
DTSTART:20261002T170000
SUMMARY:Floating time
END:VEVENT
BEGIN:VEVENT
UID:unknown-zone@test
DTSTART;TZID=Somewhere/Unknown:20261002T180000
SUMMARY:Unknown zone
END:VEVENT
END:VCALENDAR
`;
  const events = parseCalendar(feed, from, to);
  assert.deepEqual(
    events.map((event) => [event.title, event.start]),
    [
      ["Floating time", "2026-10-02T09:00:00.000Z"],
      ["Unknown zone", "2026-10-02T10:00:00.000Z"],
    ],
  );
});

test("an all-day event that ended at midnight isn't shown the next day", () => {
  const events = parseCalendar(FEED, new Date("2026-10-12T00:00:00+08:00"), to);
  assert.ok(!events.some((event) => event.title === "TISSA Tournament"), "Oct 10–11 tournament is over by Oct 12");
  const during = parseCalendar(FEED, new Date("2026-10-11T00:00:00+08:00"), to);
  assert.ok(during.some((event) => event.title === "TISSA Tournament"), "still shown on its last day");
});
