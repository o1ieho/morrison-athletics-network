// Derived views of a game for the graphics on the game page: quarter-by-quarter
// line score, the score-margin timeline ("game flow"), scoring runs and key
// plays, and shooting by court zone. Pure functions over events, so they're
// easy to test.

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

export type LineScore = {
  labels: string[];
  /** Points per period; null for periods a live game hasn't reached yet. */
  team: Array<number | null>;
  opponent: Array<number | null>;
};

/**
 * Points per period for both sides; always shows every regulation period.
 * While a game is live, periods after the current one are null (shown as "–"
 * rather than a misleading 0).
 */
export function lineScore(game: Pick<Game, "periodCount" | "currentPeriod"> & { status?: Game["status"] }, events: GameEvent[]): LineScore {
  const scoring = activeEvents(events).filter((event) => event.points > 0);
  const lastPeriod = Math.max(game.periodCount, game.currentPeriod, ...scoring.map((event) => event.period));
  const periods = Array.from({ length: lastPeriod }, (_, index) => index + 1);
  const sum = (side: "team" | "opponent", period: number) =>
    game.status === "live" && period > game.currentPeriod
      ? null
      : scoring.filter((event) => event.side === side && event.period === period).reduce((total, event) => total + event.points, 0);
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
  let leadChanges = 0;
  let ties = 0;
  const largestLead = { team: 0, opponent: 0 };
  const active = activeEvents(events);
  const lastPeriod = Math.max(1, ...active.map((event) => event.period));

  for (const play of scoringPlays(active)) {
    const margin = play.team - play.opponent;
    if (play.tie) ties += 1;
    if (play.leadChange) leadChanges += 1;
    largestLead.team = Math.max(largestLead.team, margin);
    largestLead.opponent = Math.max(largestLead.opponent, -margin);
    points.push({ t: elapsedSeconds(game, play.event.period, play.event.clockSecondsLeft), team: play.team, opponent: play.opponent, margin });
  }

  return {
    points,
    duration: totalSeconds(game, Math.max(lastPeriod, game.currentPeriod)),
    leadChanges,
    ties,
    largestLead,
  };
}

/**
 * Game seconds each side spent ahead, from tip-off to `endT` (the current game
 * time for a live game; the whole game once it's final). FIBA's "Time leading".
 */
export function timeLeading(flow: GameFlow, endT = flow.duration) {
  const result = { team: 0, opponent: 0 };
  flow.points.forEach((point, index) => {
    const from = Math.min(point.t, endT);
    const to = Math.min(flow.points[index + 1]?.t ?? endT, endT);
    if (to <= from) return;
    if (point.margin > 0) result.team += to - from;
    else if (point.margin < 0) result.opponent += to - from;
  });
  return result;
}

// ---------------------------------------------------------------------------
// Scoring plays, runs and key plays
// ---------------------------------------------------------------------------

export type ScoringPlay = {
  event: GameEvent;
  /** Running score after this play. */
  team: number;
  opponent: number;
  /** The play put the other side in front. */
  leadChange: boolean;
  /** The play tied the game. */
  tie: boolean;
};

/** Every active scoring play, oldest first, with the score after it. */
export function scoringPlays(events: GameEvent[]): ScoringPlay[] {
  const plays: ScoringPlay[] = [];
  let team = 0;
  let opponent = 0;
  let leader: "team" | "opponent" | null = null;
  for (const event of chronological(activeEvents(events))) {
    if (event.points <= 0 || event.side === "game") continue;
    if (event.side === "team") team += event.points;
    else opponent += event.points;
    const nowLeading = team > opponent ? "team" : opponent > team ? "opponent" : null;
    plays.push({
      event,
      team,
      opponent,
      leadChange: nowLeading !== null && leader !== null && nowLeading !== leader,
      tie: nowLeading === null,
    });
    if (nowLeading !== null) leader = nowLeading;
  }
  return plays;
}

/** A run starts showing on the scoreboard once it reaches this many unanswered points. */
export const RUN_MIN_POINTS = 6;

export type Run = {
  side: "team" | "opponent";
  /** Unanswered points (the "8" in "8-0 run"). */
  points: number;
  /** Scoring plays in the run. */
  plays: number;
  /** First and latest scoring plays of the run. */
  start: GameEvent;
  end: GameEvent;
};

/** Splits the game into unanswered scoring stretches, oldest first. A run carries across quarter breaks. */
export function scoringRuns(events: GameEvent[]): Run[] {
  const runs: Run[] = [];
  for (const { event } of scoringPlays(events)) {
    const side = event.side as Run["side"];
    const last = runs[runs.length - 1];
    if (last && last.side === side) {
      last.points += event.points;
      last.plays += 1;
      last.end = event;
    } else {
      runs.push({ side, points: event.points, plays: 1, start: event, end: event });
    }
  }
  return runs;
}

/** The run still going (no answer from the other side yet), if it's big enough to call a run. */
export function currentRun(events: GameEvent[], minPoints = RUN_MIN_POINTS): Run | null {
  const runs = scoringRuns(events);
  const last = runs[runs.length - 1];
  return last && last.points >= minPoints && last.plays >= 2 ? last : null;
}

/** Each side's biggest unanswered run of the game (the earliest one on a tie). */
export function biggestRuns(events: GameEvent[]): { team: Run | null; opponent: Run | null } {
  const best: { team: Run | null; opponent: Run | null } = { team: null, opponent: null };
  for (const run of scoringRuns(events)) {
    if (run.points > (best[run.side]?.points ?? 0)) best[run.side] = run;
  }
  return best;
}

export type PlayNote = {
  /** Running score after this play. */
  team: number;
  opponent: number;
  leadChange: boolean;
  tie: boolean;
  /** Set on the play that takes an unanswered run to RUN_MIN_POINTS or more. */
  run?: { side: Run["side"]; points: number };
  /** Set when the play takes its scorer to 10 or 20 points. */
  milestone?: number;
  /** Worth showing under the "Key plays" filter. */
  key: boolean;
};

const MILESTONES = [20, 10];

/**
 * Notes for every active play, for the play-by-play: the running score, lead
 * changes, ties, run starts and scoring milestones. "Key" plays are made
 * 3-pointers, lead changes, ties, run starts, period ends and milestones.
 */
export function annotatePlays(events: GameEvent[]): Map<string, PlayNote> {
  const notes = new Map<string, PlayNote>();
  const scoring = new Map(scoringPlays(events).map((play) => [play.event.id, play]));
  const playerPoints = new Map<string, number>();
  let team = 0;
  let opponent = 0;
  let run: { side: Run["side"]; points: number } | null = null;

  for (const event of chronological(activeEvents(events))) {
    const play = scoring.get(event.id);
    const note: PlayNote = { team, opponent, leadChange: false, tie: false, key: event.type === "period_end" };
    if (play) {
      team = note.team = play.team;
      opponent = note.opponent = play.opponent;
      note.leadChange = play.leadChange;
      note.tie = play.tie;
      const side = event.side as Run["side"];
      const before: number = run?.side === side ? run.points : 0;
      run = { side, points: before + event.points };
      if (before < RUN_MIN_POINTS && run.points >= RUN_MIN_POINTS) note.run = { ...run };

      if (event.athleteId) {
        const previous = playerPoints.get(event.athleteId) ?? 0;
        const now = previous + event.points;
        playerPoints.set(event.athleteId, now);
        note.milestone = MILESTONES.find((mark) => previous < mark && now >= mark);
      }
      note.key = event.type === "fg3_made" || note.leadChange || note.tie || Boolean(note.run) || Boolean(note.milestone);
    }
    notes.set(event.id, note);
  }
  return notes;
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
