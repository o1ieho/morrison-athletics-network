import assert from "node:assert/strict";
import { test } from "node:test";
import {
  annotatePlays,
  biggestRuns,
  currentRun,
  elapsedSeconds,
  gameFlow,
  lineScore,
  scoringRuns,
  shotZone,
  timeLeading,
  zoneStats,
} from "./game-analysis.ts";
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

test("line score leaves periods a live game hasn't reached blank", () => {
  const live = lineScore({ periodCount: 4, currentPeriod: 2, status: "live" }, events.slice(0, 4));
  assert.deepEqual(live.team, [2, 2, null, null]);
  assert.deepEqual(live.opponent, [3, 1, null, null]);
  // Once final, every period shows a number.
  assert.deepEqual(lineScore({ periodCount: 4, currentPeriod: 2, status: "final" }, events.slice(0, 4)).team, [2, 2, 0, 0]);
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

test("time leading adds up the seconds each side was ahead", () => {
  const flow = gameFlow(game, events);
  // Margins from game second t: 0 (0), 80 (+2), 180 (-1), 760 (+1), 860 (0), 1890 (+3) to the end at 1920.
  assert.deepEqual(timeLeading(flow), { team: 100 + 100 + 30, opponent: 580 });
  // Cut off at a live game time.
  assert.deepEqual(timeLeading(flow, 500), { team: 100, opponent: 320 });
});

// Broncos 2, 3, 2 (7-0), Huskies 2, Broncos 2, 2, 3 across the quarter break (7-0), Huskies 3.
const runGame = [
  play("team", "fg2_made", 1, 400),
  play("team", "fg3_made", 1, 380),
  play("team", "rebound_def", 1, 370),
  play("team", "fg2_made", 1, 360),
  play("opponent", "fg2_made", 1, 300),
  play("team", "fg2_made", 1, 20),
  play("game", "period_end", 1, 0),
  play("team", "fg2_made", 2, 470),
  play("team", "fg3_made", 2, 450),
];

test("scoring runs split the game into unanswered stretches", () => {
  assert.deepEqual(
    scoringRuns(runGame).map((run) => [run.side, run.points, run.plays]),
    [
      ["team", 7, 3],
      ["opponent", 2, 1],
      ["team", 7, 3],
    ],
  );
  const run = currentRun(runGame);
  assert.ok(run);
  assert.equal(run.points, 7);
  assert.equal(run.start.period, 1, "a run carries across the quarter break");
  assert.equal(run.start.clockSecondsLeft, 20);
  // Answered: no current run. Too small: no current run.
  assert.equal(currentRun([...runGame, play("opponent", "fg3_made", 2, 400)]), null);
  assert.equal(currentRun(runGame.slice(0, 2)), null);
  // Biggest runs: earliest wins a tie.
  const best = biggestRuns(runGame);
  assert.equal(best.team?.start.id, runGame[0].id);
  assert.equal(best.opponent?.points, 2);
});

test("run and lead-change counting ignore voided plays", () => {
  const voided = [play("team", "fg3_made", 1, 400), play("team", "fg3_made", 1, 390, { voidedAt: "2026-01-01T00:00:00Z" })];
  assert.equal(scoringRuns(voided)[0].points, 3);
});

test("play notes flag lead changes, ties, run starts, milestones and key plays", () => {
  const plays = [
    play("team", "fg2_made", 1, 400), //                          2–0
    play("opponent", "fg3_made", 1, 390), //                       2–3 lead change (key)
    play("team", "fg2_made", 1, 380, { athleteId: "b" }), //       4–3 lead change
    play("opponent", "ft_made", 1, 370), //                        4–4 tie
    play("team", "fg3_made", 1, 360, { athleteId: "b" }), //       7–4 made 3 (key)
    play("team", "fg2_made", 1, 350, { athleteId: "b" }), //       9–4 run 5-0
    play("team", "steal", 1, 345),
    play("team", "fg3_made", 1, 340, { athleteId: "b" }), //       12–4 run 8-0 starts, b reaches 10
    play("team", "fg2_made", 1, 330), //                           14–4 not key
    play("game", "period_end", 1, 0), //                           key
  ];
  const notes = annotatePlays(plays);
  const note = (index: number) => notes.get(plays[index].id)!;
  assert.equal(note(0).key, false);
  assert.equal(note(1).leadChange, true);
  assert.equal(note(2).leadChange, true);
  assert.equal(note(3).tie, true);
  assert.equal(note(4).key, true);
  assert.equal(note(5).run, undefined);
  assert.deepEqual([note(6).team, note(6).opponent, note(6).key], [9, 4, false]);
  assert.deepEqual(note(7).run, { side: "team", points: 8 });
  assert.equal(note(7).milestone, 10);
  assert.equal(note(8).key, false);
  assert.equal(note(8).run, undefined, "only the play that crosses the threshold starts a run");
  assert.deepEqual([note(9).key, note(9).team, note(9).opponent], [true, 14, 4]);
});
