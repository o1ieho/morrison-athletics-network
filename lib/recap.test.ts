import assert from "node:assert/strict";
import { test } from "node:test";
import { keyMoments, lastMeeting, recapHeadline, recentForm, runWithArticle } from "./recap.ts";
import type { EventType, GameEvent, GameSummary, RosterPlayer, Side } from "./types.ts";

const rules = { periodCount: 4, periodLengthSeconds: 480, overtimeLengthSeconds: 240, currentPeriod: 4 };
const names = { team: "Broncos", opponent: "Huskies" };

let n = 0;
function play(side: Side, type: EventType, period: number, clock: number, athleteId: string | null = null): GameEvent {
  n += 1;
  return {
    id: `e${n}`,
    gameId: "g",
    side,
    athleteId,
    type,
    period,
    clockSecondsLeft: clock,
    points: { fg2_made: 2, fg3_made: 3, ft_made: 1 }[type as string] ?? 0,
    shotX: null,
    shotY: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(),
    voidedAt: null,
  };
}

function score(events: GameEvent[]) {
  const total = (side: Side) => events.filter((event) => event.side === side).reduce((sum, event) => sum + event.points, 0);
  return { ...rules, teamScore: total("team"), opponentScore: total("opponent") };
}

test("headline: wire-to-wire when the winner led after every score", () => {
  const events = [play("team", "fg2_made", 1, 400), play("opponent", "ft_made", 1, 300), play("team", "fg3_made", 2, 300), play("opponent", "fg2_made", 3, 200)];
  assert.equal(recapHeadline(score(events), events, names), "Broncos win wire-to-wire");
});

test("headline: a close finish is worded by who led going into the last two minutes", () => {
  // Behind all game, won with a 3 at 0:10: a rally, not a hold-off.
  const rally = [play("opponent", "fg2_made", 1, 400), play("team", "fg3_made", 4, 10)];
  assert.equal(recapHeadline(score(rally), rally, names), "Broncos rally past Huskies");
  // Ahead at 2:00 and survived a late basket.
  const holdOff = [
    play("opponent", "fg2_made", 1, 400),
    play("team", "fg3_made", 3, 200),
    play("team", "fg2_made", 4, 300),
    play("opponent", "fg2_made", 4, 20),
  ];
  assert.equal(recapHeadline(score(holdOff), holdOff, names), "Broncos hold off Huskies");
  // Level at 2:00.
  const edge = [play("opponent", "fg2_made", 1, 400), play("team", "fg2_made", 3, 200), play("team", "fg2_made", 4, 30)];
  assert.equal(recapHeadline(score(edge), edge, names), "Broncos edge Huskies");
});

test("runs get the right article", () => {
  assert.equal(runWithArticle(6), "a 6-0");
  assert.equal(runWithArticle(8), "an 8-0");
  assert.equal(runWithArticle(11), "an 11-0");
  assert.equal(runWithArticle(18), "an 18-0");
  assert.equal(runWithArticle(12), "a 12-0");
});

test("headline: a big run wins out over the decisive quarter", () => {
  const events = [
    play("opponent", "fg3_made", 1, 400),
    ...Array.from({ length: 6 }, (_, index) => play("team", "fg2_made", 2, 400 - index * 20)), // 12-0
    play("opponent", "fg2_made", 3, 200),
  ];
  assert.equal(recapHeadline(score(events), events, names), "Broncos ride 12-0 run past Huskies");
});

test("headline: otherwise the quarter the winner won by the most", () => {
  const events = [
    play("opponent", "fg2_made", 1, 400),
    play("team", "fg2_made", 1, 390),
    play("opponent", "fg2_made", 1, 380),
    play("team", "fg3_made", 3, 300),
    play("opponent", "fg2_made", 3, 290),
    play("team", "fg3_made", 3, 280),
    play("opponent", "ft_made", 3, 270),
    play("team", "fg3_made", 3, 260),
  ];
  // Q3: Broncos 9, Huskies 3.
  assert.equal(recapHeadline(score(events), events, names), "Broncos pull away with 9-3 third quarter");
  // From the Huskies' side, a loss reads the other way round.
  assert.equal(recapHeadline({ ...score(events), teamScore: 0 }, events, names).startsWith("Huskies"), true);
});

test("key moments: biggest run, last lead change, top scorer and biggest lead", () => {
  const roster: RosterPlayer[] = [
    { athleteId: "a", slug: "sam-chancler", name: "Sam Chancler", teamId: "t", number: 9, position: null, grade: null, height: null },
  ];
  const events = [
    play("opponent", "fg2_made", 1, 400),
    play("team", "fg3_made", 1, 390, "a"), // lead change 3–2
    play("team", "fg2_made", 1, 380, "a"),
    play("team", "fg2_miss", 1, 375, "a"),
    play("team", "fg2_made", 1, 370, "a"), // 7-0 run, lead 7–2 = 5
    play("opponent", "fg2_made", 1, 300),
  ];
  const moments = keyMoments(score(events), events, roster, names);
  assert.deepEqual(
    moments.map((moment) => moment.tag),
    ["7-0 run", "Lead change", "Top scorer", "Biggest lead"],
  );
  assert.equal(moments[0].eventId, events[1].id);
  assert.equal(moments[0].text, "Broncos, Q1 6:30 to Q1 6:10");
  assert.equal(moments[1].text, "Broncos go ahead 3-2, Q1 6:30");
  assert.equal(moments[2].text, "#9 S. Chancler 7 PTS, 3-4 FG");
  assert.equal(moments[2].playerSlug, "sam-chancler");
  assert.equal(moments[3].text, "Broncos by 5, Q1 6:10");
  assert.equal(moments[3].eventId, events[4].id);
});

function game(id: string, startsAt: string, teamScore: number, opponentScore: number, opponentId = "o1", status: GameSummary["status"] = "final") {
  return { id, startsAt, teamScore, opponentScore, opponentId, status } as GameSummary;
}

test("form guide and last meeting only look at earlier finals", () => {
  const games = [
    game("g1", "2026-01-01T00:00:00Z", 50, 40),
    game("g2", "2026-01-08T00:00:00Z", 30, 40, "o2"),
    game("g3", "2026-01-15T00:00:00Z", 45, 45),
    game("g4", "2026-01-22T00:00:00Z", 0, 0, "o1", "scheduled"),
    game("g5", "2026-01-29T00:00:00Z", 60, 50, "o1"),
  ];
  assert.deepEqual(
    recentForm(games, "2026-01-22T00:00:00Z").map((entry) => [entry.game.id, entry.result]),
    [
      ["g1", "W"],
      ["g2", "L"],
      ["g3", "T"],
    ],
  );
  assert.equal(recentForm(games, "2026-12-31T00:00:00Z", 2).length, 2);
  assert.equal(lastMeeting(games, games[3])?.id, "g3");
  assert.equal(lastMeeting(games, { id: "x", opponentId: "o3", startsAt: "2026-12-31T00:00:00Z" }), null);
});
