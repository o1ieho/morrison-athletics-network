import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  clockSecondsLeft,
  computeBoxScore,
  describeEvent,
  formatClock,
  gameLeaders,
  parseClock,
  periodLabel,
  teamFouls,
  timeoutsUsed,
} from "./basketball.ts";
import type { EventType, GameEvent, RosterPlayer, Side, StatLine } from "./types.ts";

let sequence = 0;
function event(side: Side, type: EventType, athleteId: string | null = null, extra: Partial<GameEvent> = {}): GameEvent {
  sequence += 1;
  return {
    id: `e${sequence}`,
    gameId: "g",
    side,
    athleteId,
    type,
    period: 1,
    clockSecondsLeft: 400,
    points: { fg2_made: 2, fg3_made: 3, ft_made: 1 }[type as string] ?? 0,
    shotX: null,
    shotY: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString(),
    voidedAt: null,
    ...extra,
  };
}

const roster: RosterPlayer[] = [
  { athleteId: "a", slug: "a", name: "Ann", teamId: "t", number: 7, position: "PG", grade: null, height: null },
  { athleteId: "b", slug: "b", name: "Bea", teamId: "t", number: 3, position: "C", grade: null, height: null },
];

describe("clock", () => {
  test("formats and parses", () => {
    assert.equal(formatClock(450), "7:30");
    assert.equal(formatClock(5), "0:05");
    assert.equal(formatClock(-3), "0:00");
    assert.equal(parseClock("7:30"), 450);
    assert.equal(parseClock("730"), 450);
    assert.equal(parseClock("45"), 45);
    assert.equal(parseClock("7:75"), null);
    assert.equal(parseClock("abc"), null);
  });

  test("a stopped clock does not move", () => {
    const game = { clockRunning: false, clockSecondsLeft: 300, clockAnchorAt: null };
    assert.equal(clockSecondsLeft(game, Date.now()), 300);
  });

  test("a running clock counts down from its anchor, corrected for device skew", () => {
    const anchor = Date.UTC(2026, 0, 1, 12, 0, 0);
    const game = { clockRunning: true, clockSecondsLeft: 300, clockAnchorAt: new Date(anchor).toISOString() };
    assert.equal(clockSecondsLeft(game, anchor + 30_500), 270);
    // Device clock is 10s behind the server.
    assert.equal(clockSecondsLeft(game, anchor + 20_500, 10_000), 270);
    assert.equal(clockSecondsLeft(game, anchor + 900_000), 0);
  });

  test("period labels", () => {
    assert.equal(periodLabel(1), "Q1");
    assert.equal(periodLabel(4), "Q4");
    assert.equal(periodLabel(5), "OT");
    assert.equal(periodLabel(6), "2OT");
  });
});

describe("team fouls and timeouts", () => {
  const events = [
    event("team", "foul", "a", { period: 1 }),
    event("team", "foul", "a", { period: 2 }),
    event("team", "foul", "b", { period: 2 }),
    event("team", "foul", "b", { period: 2, voidedAt: "2026-01-01T00:00:00Z" }),
    event("opponent", "foul", null, { period: 2 }),
    event("team", "timeout", null, { period: 2 }),
  ];

  test("reset every quarter", () => {
    const game = { foulReset: "quarter" as const, periodCount: 4, currentPeriod: 2 };
    assert.equal(teamFouls(game, events, "team"), 2);
    assert.equal(teamFouls(game, events, "opponent"), 1);
  });

  test("reset every half", () => {
    const game = { foulReset: "half" as const, periodCount: 4, currentPeriod: 2 };
    assert.equal(teamFouls(game, events, "team"), 3);
  });

  test("overtime continues the last period's count", () => {
    const game = { foulReset: "quarter" as const, periodCount: 4, currentPeriod: 5 };
    const late = [event("team", "foul", "a", { period: 4 }), event("team", "foul", "a", { period: 5 })];
    assert.equal(teamFouls(game, late, "team"), 1);
  });

  test("timeouts ignore voided events", () => {
    assert.equal(timeoutsUsed(events, "team"), 1);
    assert.equal(timeoutsUsed(events, "opponent"), 0);
  });
});

describe("box score", () => {
  test("counts makes, misses, rebounds and ignores voided events", () => {
    const events = [
      event("team", "fg3_made", "a"),
      event("team", "fg2_miss", "a"),
      event("team", "rebound_off", "b"),
      event("team", "fg2_made", "b"),
      event("team", "assist", "a"),
      event("team", "ft_made", "b"),
      event("team", "ft_miss", "b"),
      event("team", "fg3_made", "b", { voidedAt: "2026-01-01T00:00:00Z" }),
      event("team", "rebound_def", null),
      event("opponent", "fg2_made"),
      event("opponent", "foul"),
      event("game", "period_end"),
    ];
    const box = computeBoxScore(events, roster);
    const byId = Object.fromEntries(box.players.map((row) => [row.player.athleteId, row.line]));

    assert.deepEqual(pick(byId.a, ["pts", "fgm", "fga", "fg3m", "fg3a", "ast"]), { pts: 3, fgm: 1, fga: 2, fg3m: 1, fg3a: 1, ast: 1 });
    assert.deepEqual(pick(byId.b, ["pts", "fgm", "fga", "ftm", "fta", "oreb", "reb"]), { pts: 3, fgm: 1, fga: 1, ftm: 1, fta: 2, oreb: 1, reb: 1 });
    assert.equal(box.unassigned.dreb, 1);
    assert.equal(box.team.pts, 6);
    assert.equal(box.team.reb, 2);
    assert.deepEqual(box.opponent, { pts: 2, pf: 1, timeouts: 0 });
    // Sorted by jersey number.
    assert.deepEqual(box.players.map((row) => row.player.number), [3, 7]);
    assert.equal(gameLeaders(box).pts?.value, 3);
  });

  test("describes plays", () => {
    const names = { team: "MAT Broncos", opponent: "Tigers", player: roster[0] };
    assert.equal(describeEvent({ side: "team", type: "fg3_made", period: 1 }, names), "#7 Ann made a 3-pointer");
    assert.equal(describeEvent({ side: "opponent", type: "fg2_made", period: 1 }, names), "Tigers made a 2-pointer");
    assert.equal(describeEvent({ side: "game", type: "period_start", period: 5 }, names), "OT started");
    assert.equal(describeEvent({ side: "team", type: "timeout", period: 2 }, names), "MAT Broncos called a timeout");
  });
});

// Cross-checks the TypeScript box score against the SQL view on the local demo
// database (built by `npm run db:local`). Skipped when that database is absent.
describe("agrees with public.player_game_stats", () => {
  const database = process.env.SSN_TEST_DB ?? "ssn_pilot_test";
  let rows: { events: Array<Record<string, unknown>>; stats: Array<Record<string, number | string>> } | null = null;
  try {
    const output = execFileSync(
      "psql",
      [
        "-X", "-At", "-d", database, "-c",
        `select json_build_object(
          'events', (select json_agg(e) from game_events e where game_id = 'demo-final-knights'),
          'stats', (select json_agg(s) from player_game_stats s where game_id = 'demo-final-knights'))`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    rows = JSON.parse(output);
  } catch {
    rows = null;
  }

  test("demo-final-knights box score matches", { skip: rows === null ? "local database not available" : false }, () => {
    const events: GameEvent[] = rows!.events.map((row) => ({
      id: String(row.id),
      gameId: String(row.game_id),
      side: row.side as Side,
      athleteId: (row.athlete_id as string | null) ?? null,
      type: row.event_type as EventType,
      period: Number(row.period),
      clockSecondsLeft: Number(row.clock_seconds_left),
      points: Number(row.points),
      shotX: null,
      shotY: null,
      createdAt: String(row.created_at),
      voidedAt: (row.voided_at as string | null) ?? null,
    }));
    const athleteIds = [...new Set(events.map((e) => e.athleteId).filter((id): id is string => Boolean(id)))];
    const box = computeBoxScore(
      events,
      athleteIds.map((id) => ({ athleteId: id, slug: id, name: id, teamId: "bbb-v", number: null, position: null, grade: null, height: null })),
    );
    const keys = ["pts", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "reb", "ast", "stl", "blk", "tov", "pf"] as const;
    for (const stat of rows!.stats) {
      const line = box.players.find((row) => row.player.athleteId === stat.athlete_id)!.line;
      assert.deepEqual(pick(line, [...keys]), Object.fromEntries(keys.map((key) => [key, Number(stat[key])])), String(stat.athlete_id));
    }
  });
});

function pick(line: StatLine, keys: Array<keyof StatLine>) {
  return Object.fromEntries(keys.map((key) => [key, line[key]]));
}
