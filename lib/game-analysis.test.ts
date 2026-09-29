import assert from "node:assert/strict";
import { test } from "node:test";
import { elapsedSeconds, gameFlow, lineScore, shotZone, zoneStats } from "./game-analysis.ts";
import type { EventType, GameEvent, Side } from "./types.ts";

const game = { periodCount: 4, periodLengthSeconds: 480, overtimeLengthSeconds: 240, currentPeriod: 4 };

let n = 0;
function play(side: Side, type: EventType, period: number, clock: number, extra: Partial<GameEvent> = {}): GameEvent {
  n += 1;
  return {
    id: `e${n}`,
    gameId: "g",
    side,
    athleteId: side === "team" ? "a" : null,
    type,
    period,
    clockSecondsLeft: clock,
    points: { fg2_made: 2, fg3_made: 3, ft_made: 1 }[type as string] ?? 0,
    shotX: null,
    shotY: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(),
    voidedAt: null,
    ...extra,
  };
}

test("elapsed game time across quarters and overtime", () => {
  assert.equal(elapsedSeconds(game, 1, 480), 0);
  assert.equal(elapsedSeconds(game, 2, 420), 540);
  assert.equal(elapsedSeconds(game, 4, 0), 1920);
  assert.equal(elapsedSeconds(game, 5, 120), 2040);
});

const events = [
  play("team", "fg2_made", 1, 400), //         2–0
  play("opponent", "fg3_made", 1, 300), //     2–3  lead change
  play("team", "fg2_made", 2, 200), //         4–3  lead change
  play("opponent", "ft_made", 2, 100), //      4–4  tie
  play("team", "fg3_made", 3, 50, { voidedAt: "2026-01-01T00:00:00Z" }), // undone
  play("team", "fg3_made", 4, 30), //          7–4
  play("team", "rebound_def", 4, 20),
];

test("line score by quarter ignores voided plays", () => {
  assert.deepEqual(lineScore(game, events), {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    team: [2, 2, 0, 3],
    opponent: [3, 1, 0, 0],
  });
  const withOvertime = lineScore({ periodCount: 4, currentPeriod: 5 }, [...events, play("team", "ft_made", 5, 10)]);
  assert.deepEqual(withOvertime.labels, ["Q1", "Q2", "Q3", "Q4", "OT"]);
  assert.equal(withOvertime.team[4], 1);
});

test("game flow tracks margin, lead changes, ties and biggest leads", () => {
  const flow = gameFlow(game, events);
  assert.deepEqual(
    flow.points.map((point) => [point.team, point.opponent, point.margin]),
    [
      [0, 0, 0],
      [2, 0, 2],
      [2, 3, -1],
      [4, 3, 1],
      [4, 4, 0],
      [7, 4, 3],
    ],
  );
  assert.equal(flow.leadChanges, 2);
  assert.equal(flow.ties, 1);
  assert.deepEqual(flow.largestLead, { team: 3, opponent: 1 });
  assert.equal(flow.duration, 1920);
  assert.equal(flow.points[1].t, 80);
});

test("shot zones follow the FIBA court", () => {
  const at = (x: number, y: number) => shotZone(x / 15, y / 14);
  assert.equal(at(7.5, 2.5), "paint");
  assert.equal(at(3.5, 4), "midrange");
  assert.equal(at(0.4, 1), "corner3Left");
  assert.equal(at(14.6, 1), "corner3Right");
  assert.equal(at(7.5, 9.5), "aboveBreak3");
});

test("zone stats count makes and attempts per zone and player", () => {
  const shots = [
    play("team", "fg2_made", 1, 400, { shotX: 0.5, shotY: 0.18 }),
    play("team", "fg2_miss", 1, 390, { shotX: 0.5, shotY: 0.18 }),
    play("team", "fg3_made", 1, 380, { shotX: 0.03, shotY: 0.07, athleteId: "b" }),
    play("team", "fg2_made", 1, 370), // no spot marked: not counted
  ];
  const all = zoneStats(shots);
  assert.deepEqual(all.paint, { made: 1, attempts: 2 });
  assert.deepEqual(all.corner3Left, { made: 1, attempts: 1 });
  assert.deepEqual(zoneStats(shots, "b").paint, { made: 0, attempts: 0 });
});
