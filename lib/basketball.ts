// Basketball rules and stat math shared by the operator console, public pages
// and tests. Pure functions only: no framework or database imports, so this
// file runs unchanged in the browser, on the server and under `node --test`.

import type { EventType, Game, GameEvent, RosterPlayer, Side, StatLine } from "./types";

type EventMeta = {
  label: string;
  /** Past-tense phrase for play-by-play, e.g. "made a 3-pointer". */
  phrase: string;
  points: number;
  isFieldGoal: boolean;
  isShot: boolean;
  made: boolean;
};

export const EVENT_META: Record<EventType, EventMeta> = {
  fg2_made: { label: "2PT made", phrase: "made a 2-pointer", points: 2, isFieldGoal: true, isShot: true, made: true },
  fg2_miss: { label: "2PT miss", phrase: "missed a 2-pointer", points: 0, isFieldGoal: true, isShot: true, made: false },
  fg3_made: { label: "3PT made", phrase: "made a 3-pointer", points: 3, isFieldGoal: true, isShot: true, made: true },
  fg3_miss: { label: "3PT miss", phrase: "missed a 3-pointer", points: 0, isFieldGoal: true, isShot: true, made: false },
  ft_made: { label: "FT made", phrase: "made a free throw", points: 1, isFieldGoal: false, isShot: true, made: true },
  ft_miss: { label: "FT miss", phrase: "missed a free throw", points: 0, isFieldGoal: false, isShot: true, made: false },
  rebound_off: { label: "Off. rebound", phrase: "grabbed an offensive rebound", points: 0, isFieldGoal: false, isShot: false, made: false },
  rebound_def: { label: "Def. rebound", phrase: "grabbed a defensive rebound", points: 0, isFieldGoal: false, isShot: false, made: false },
  assist: { label: "Assist", phrase: "assist", points: 0, isFieldGoal: false, isShot: false, made: false },
  steal: { label: "Steal", phrase: "stole the ball", points: 0, isFieldGoal: false, isShot: false, made: false },
  block: { label: "Block", phrase: "blocked a shot", points: 0, isFieldGoal: false, isShot: false, made: false },
  turnover: { label: "Turnover", phrase: "turned it over", points: 0, isFieldGoal: false, isShot: false, made: false },
  foul: { label: "Foul", phrase: "committed a foul", points: 0, isFieldGoal: false, isShot: false, made: false },
  timeout: { label: "Timeout", phrase: "called a timeout", points: 0, isFieldGoal: false, isShot: false, made: false },
  period_start: { label: "Period start", phrase: "started", points: 0, isFieldGoal: false, isShot: false, made: false },
  period_end: { label: "Period end", phrase: "ended", points: 0, isFieldGoal: false, isShot: false, made: false },
};

/** Event types the operator can log for the opponent (team totals only). */
export const OPPONENT_EVENT_TYPES: EventType[] = ["fg2_made", "fg3_made", "ft_made", "foul", "timeout"];

export function pointsFor(type: EventType): number {
  return EVENT_META[type].points;
}

export function activeEvents(events: GameEvent[]): GameEvent[] {
  return events.filter((event) => !event.voidedAt);
}

/** Sorts events oldest first (the order they happened). */
export function chronological(events: GameEvent[]): GameEvent[] {
  return [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Clock and periods
// ---------------------------------------------------------------------------

/**
 * Seconds left on the game clock at `nowMs`. `serverOffsetMs` is the server's
 * clock minus this device's clock, so phones with a wrong time still agree.
 */
export function clockSecondsLeft(
  game: Pick<Game, "clockRunning" | "clockSecondsLeft" | "clockAnchorAt">,
  nowMs: number,
  serverOffsetMs = 0,
): number {
  if (!game.clockRunning || !game.clockAnchorAt) return game.clockSecondsLeft;
  const elapsed = Math.floor((nowMs + serverOffsetMs - Date.parse(game.clockAnchorAt)) / 1000);
  return Math.max(0, game.clockSecondsLeft - Math.max(0, elapsed));
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Parses "7:30", "730" or "45" into seconds. Returns null when unreadable. */
export function parseClock(value: string): number | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/) ?? trimmed.match(/^(\d{1,2})(\d{2})$/);
  if (match) {
    const seconds = Number(match[2]);
    return seconds < 60 ? Number(match[1]) * 60 + seconds : null;
  }
  return /^\d{1,2}$/.test(trimmed) ? Number(trimmed) : null;
}

export function periodLabel(period: number, periodCount = 4): string {
  if (period <= periodCount) return periodCount === 2 ? `H${period}` : `Q${period}`;
  const overtime = period - periodCount;
  return overtime === 1 ? "OT" : `${overtime}OT`;
}

export function periodLengthSeconds(game: Pick<Game, "periodCount" | "periodLengthSeconds" | "overtimeLengthSeconds">, period: number) {
  return period > game.periodCount ? game.overtimeLengthSeconds : game.periodLengthSeconds;
}

/** Periods that share a team-foul count with `period` under the game's reset rule. */
function foulWindow(game: Pick<Game, "foulReset" | "periodCount">, period: number): (p: number) => boolean {
  if (period > game.periodCount) {
    // Overtime continues the fouls of the final period's window.
    return foulWindow(game, game.periodCount);
  }
  if (game.foulReset === "half" && game.periodCount === 4) {
    const firstHalf = period <= 2;
    return (p) => (firstHalf ? p <= 2 : p > 2);
  }
  return (p) => p === period;
}

export function teamFouls(
  game: Pick<Game, "foulReset" | "periodCount" | "currentPeriod">,
  events: GameEvent[],
  side: "team" | "opponent",
): number {
  const inWindow = foulWindow(game, game.currentPeriod);
  return activeEvents(events).filter((event) => event.side === side && event.type === "foul" && inWindow(event.period)).length;
}

export function timeoutsUsed(events: GameEvent[], side: "team" | "opponent"): number {
  return activeEvents(events).filter((event) => event.side === side && event.type === "timeout").length;
}

// ---------------------------------------------------------------------------
// Box score
// ---------------------------------------------------------------------------

export function emptyStatLine(): StatLine {
  return { pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };
}

function addEvent(line: StatLine, type: EventType) {
  line.pts += pointsFor(type);
  switch (type) {
    case "fg2_made":
      line.fgm += 1;
      line.fga += 1;
      break;
    case "fg2_miss":
      line.fga += 1;
      break;
    case "fg3_made":
      line.fgm += 1;
      line.fga += 1;
      line.fg3m += 1;
      line.fg3a += 1;
      break;
    case "fg3_miss":
      line.fga += 1;
      line.fg3a += 1;
      break;
    case "ft_made":
      line.ftm += 1;
      line.fta += 1;
      break;
    case "ft_miss":
      line.fta += 1;
      break;
    case "rebound_off":
      line.oreb += 1;
      line.reb += 1;
      break;
    case "rebound_def":
      line.dreb += 1;
      line.reb += 1;
      break;
    case "assist":
      line.ast += 1;
      break;
    case "steal":
      line.stl += 1;
      break;
    case "block":
      line.blk += 1;
      break;
    case "turnover":
      line.tov += 1;
      break;
    case "foul":
      line.pf += 1;
      break;
    default:
      break;
  }
}

export type BoxScore = {
  players: Array<{ player: RosterPlayer; line: StatLine }>;
  /** MAT stats from events not tied to a player (e.g. a team rebound). */
  unassigned: StatLine;
  team: StatLine;
  opponent: Pick<StatLine, "pts" | "pf"> & { timeouts: number };
};

/**
 * Builds the MAT box score from events. Mirrors public.player_game_stats in
 * the database; lib/basketball.test.ts checks the two agree.
 */
export function computeBoxScore(events: GameEvent[], roster: RosterPlayer[]): BoxScore {
  const lines = new Map<string, StatLine>();
  const unassigned = emptyStatLine();
  const team = emptyStatLine();
  const opponent = { pts: 0, pf: 0, timeouts: 0 };

  for (const event of activeEvents(events)) {
    if (event.side === "team") {
      addEvent(team, event.type);
      if (event.athleteId) {
        const line = lines.get(event.athleteId) ?? emptyStatLine();
        addEvent(line, event.type);
        lines.set(event.athleteId, line);
      } else {
        addEvent(unassigned, event.type);
      }
    } else if (event.side === "opponent") {
      opponent.pts += pointsFor(event.type);
      if (event.type === "foul") opponent.pf += 1;
      if (event.type === "timeout") opponent.timeouts += 1;
    }
  }

  const players = roster
    .map((player) => ({ player, line: lines.get(player.athleteId) ?? emptyStatLine() }))
    .sort((a, b) => (a.player.number ?? 999) - (b.player.number ?? 999));

  return { players, unassigned, team, opponent };
}

export function percentage(made: number, attempted: number): string {
  if (!attempted) return "–";
  return `${Math.round((made / attempted) * 100)}%`;
}

export type Leader = { player: RosterPlayer; value: number };

export function gameLeaders(box: BoxScore): { pts?: Leader; reb?: Leader; ast?: Leader } {
  const best = (key: "pts" | "reb" | "ast"): Leader | undefined => {
    const top = box.players.reduce<{ player: RosterPlayer; line: StatLine } | undefined>(
      (leader, row) => (row.line[key] > (leader?.line[key] ?? 0) ? row : leader),
      undefined,
    );
    return top ? { player: top.player, value: top.line[key] } : undefined;
  };
  return { pts: best("pts"), reb: best("reb"), ast: best("ast") };
}

// ---------------------------------------------------------------------------
// Play-by-play text
// ---------------------------------------------------------------------------

export function playerLabel(player: Pick<RosterPlayer, "name" | "number"> | undefined): string {
  if (!player) return "MAT";
  return player.number === null ? player.name : `#${player.number} ${player.name}`;
}

export function describeEvent(
  event: Pick<GameEvent, "side" | "type" | "period">,
  names: { team: string; opponent: string; player?: Pick<RosterPlayer, "name" | "number">; periodCount?: number },
): string {
  const meta = EVENT_META[event.type];
  if (event.side === "game") {
    return `${periodLabel(event.period, names.periodCount)} ${meta.phrase}`;
  }
  if (event.side === "opponent") {
    return `${names.opponent} ${meta.phrase}`;
  }
  if (event.type === "timeout") return `${names.team} called a timeout`;
  const who = names.player ? playerLabel(names.player) : names.team;
  if (event.type === "assist") return `Assist: ${who}`;
  return `${who} ${meta.phrase}`;
}

export function sideForDisplay(side: Side, isHome: boolean): "home" | "away" | null {
  if (side === "game") return null;
  return (side === "team") === isHome ? "home" : "away";
}
