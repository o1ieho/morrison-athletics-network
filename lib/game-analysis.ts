// Derived views of a game for the graphics on the game page: quarter-by-quarter
// line score, the score-margin timeline ("game flow"), and shooting by court
// zone. Pure functions over events, so they're easy to test.

import { EVENT_META, activeEvents, chronological, periodLabel, periodLengthSeconds } from "./basketball.ts";
import { CORNER_ARC_Y, COURT, isThreePointSpot } from "./court.ts";
import type { Game, GameEvent } from "./types";

type Rules = Pick<Game, "periodCount" | "periodLengthSeconds" | "overtimeLengthSeconds">;

/** Game seconds elapsed at a given period and clock reading. */
export function elapsedSeconds(game: Rules, period: number, clockSecondsLeft: number) {
  let elapsed = 0;
  for (let p = 1; p < period; p += 1) elapsed += periodLengthSeconds(game, p);
  return elapsed + Math.max(0, periodLengthSeconds(game, period) - clockSecondsLeft);
}

export function totalSeconds(game: Rules, lastPeriod: number) {
  return elapsedSeconds(game, Math.max(lastPeriod, game.periodCount), 0);
}

// ---------------------------------------------------------------------------
// Line score
// ---------------------------------------------------------------------------

export type LineScore = { labels: string[]; team: number[]; opponent: number[] };

/** Points per period for both sides; always shows every regulation period. */
export function lineScore(game: Pick<Game, "periodCount" | "currentPeriod">, events: GameEvent[]): LineScore {
  const scoring = activeEvents(events).filter((event) => event.points > 0);
  const lastPeriod = Math.max(game.periodCount, game.currentPeriod, ...scoring.map((event) => event.period));
  const periods = Array.from({ length: lastPeriod }, (_, index) => index + 1);
  const sum = (side: "team" | "opponent", period: number) =>
    scoring.filter((event) => event.side === side && event.period === period).reduce((total, event) => total + event.points, 0);
  return {
    labels: periods.map((period) => periodLabel(period, game.periodCount)),
    team: periods.map((period) => sum("team", period)),
    opponent: periods.map((period) => sum("opponent", period)),
  };
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

export type FlowPoint = { t: number; team: number; opponent: number; margin: number };

export type GameFlow = {
  points: FlowPoint[];
  /** Game seconds covered by the chart (full regulation, or through OT). */
  duration: number;
  leadChanges: number;
  ties: number;
  largestLead: { team: number; opponent: number };
};

/** Running score after every scoring play, starting from 0–0 at tip-off. */
export function gameFlow(game: Rules & Pick<Game, "currentPeriod">, events: GameEvent[]): GameFlow {
  const points: FlowPoint[] = [{ t: 0, team: 0, opponent: 0, margin: 0 }];
  let team = 0;
  let opponent = 0;
  let leadChanges = 0;
  let ties = 0;
  let leader: "team" | "opponent" | null = null;
  const largestLead = { team: 0, opponent: 0 };
  let lastPeriod = 1;

  for (const event of chronological(activeEvents(events))) {
    lastPeriod = Math.max(lastPeriod, event.period);
    if (event.points <= 0 || event.side === "game") continue;
    if (event.side === "team") team += event.points;
    else opponent += event.points;

    const margin = team - opponent;
    const nowLeading = margin > 0 ? "team" : margin < 0 ? "opponent" : null;
    if (nowLeading === null) ties += 1;
    else if (leader !== null && nowLeading !== leader) leadChanges += 1;
    if (nowLeading !== null) leader = nowLeading;
    largestLead.team = Math.max(largestLead.team, margin);
    largestLead.opponent = Math.max(largestLead.opponent, -margin);

    points.push({ t: elapsedSeconds(game, event.period, event.clockSecondsLeft), team, opponent, margin });
  }

  return {
    points,
    duration: totalSeconds(game, Math.max(lastPeriod, game.currentPeriod)),
    leadChanges,
    ties,
    largestLead,
  };
}

// ---------------------------------------------------------------------------
// Shot zones
// ---------------------------------------------------------------------------

export type ZoneId = "paint" | "midrange" | "corner3Left" | "corner3Right" | "aboveBreak3";

export const ZONES: Array<{ id: ZoneId; label: string }> = [
  { id: "paint", label: "Paint" },
  { id: "midrange", label: "Mid-range" },
  { id: "corner3Left", label: "Left corner 3" },
  { id: "corner3Right", label: "Right corner 3" },
  { id: "aboveBreak3", label: "Above the break 3" },
];

/** Which zone a normalized shot spot falls in. */
export function shotZone(x: number, y: number): ZoneId {
  const mx = x * COURT.width;
  const my = y * COURT.depth;
  if (isThreePointSpot(x, y)) {
    if (my <= CORNER_ARC_Y) return mx < COURT.width / 2 ? "corner3Left" : "corner3Right";
    return "aboveBreak3";
  }
  if (Math.abs(mx - COURT.basket.x) <= COURT.laneHalfWidth && my <= COURT.freeThrowY) return "paint";
  return "midrange";
}

export type ZoneStats = Record<ZoneId, { made: number; attempts: number }>;

/** Field goals with a marked spot, grouped by zone. */
export function zoneStats(events: GameEvent[], athleteId?: string): ZoneStats {
  const stats = Object.fromEntries(ZONES.map((zone) => [zone.id, { made: 0, attempts: 0 }])) as ZoneStats;
  for (const event of activeEvents(events)) {
    if (event.side !== "team" || event.shotX === null || event.shotY === null) continue;
    if (!EVENT_META[event.type].isFieldGoal) continue;
    if (athleteId && event.athleteId !== athleteId) continue;
    const zone = stats[shotZone(event.shotX, event.shotY)];
    zone.attempts += 1;
    if (EVENT_META[event.type].made) zone.made += 1;
  }
  return stats;
}
