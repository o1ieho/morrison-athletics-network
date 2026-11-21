// Plain-language summaries of a game, built from computed facts with fixed
// templates (no generated text): the recap headline and "Key moments" for a
// final, and the form guide and last meeting for a pre-game page. Pure
// functions, so they're easy to test.

import { computeBoxScore, formatClock, periodLabel, playerLabel, shortName } from "./basketball.ts";
import { biggestRuns, gameFlow, lineScore, scoringPlays, scoringRuns } from "./game-analysis.ts";
import type { Game, GameEvent, GameSummary, RosterPlayer } from "./types";

type RecapGame = Pick<
  Game,
  "periodCount" | "periodLengthSeconds" | "overtimeLengthSeconds" | "currentPeriod" | "teamScore" | "opponentScore"
>;

export type KeyMoment = {
  /** Square tag text, e.g. "14-0 RUN". */
  tag: string;
  text: string;
  /** The play this moment points at in the play-by-play. */
  eventId?: string;
  /** Player page for the top scorer. */
  playerSlug?: string;
};

export type Recap = { headline: string; moments: KeyMoment[] };

const ORDINALS = ["first", "second", "third", "fourth"];

/** "third quarter", "second half", "overtime", "2OT". */
export function periodName(period: number, periodCount: number) {
  if (period > periodCount) return period === periodCount + 1 ? "overtime" : `${periodLabel(period, periodCount)}`;
  return `${ORDINALS[period - 1] ?? periodLabel(period, periodCount)} ${periodCount === 2 ? "half" : "quarter"}`;
}

/**
 * The one-line headline for a final. In order of preference:
 * - "Broncos win wire-to-wire": the winner scored first and was never tied or behind after that.
 * - "Broncos hold off Huskies": a final margin of 3 or less.
 * - "Broncos ride 12-0 run past Huskies": the winner had a run of 10 or more.
 * - "Broncos pull away with 18-6 third quarter": the quarter the winner won by the most.
 */
export function recapHeadline(game: RecapGame, events: GameEvent[], names: { team: string; opponent: string }): string {
  const margin = game.teamScore - game.opponentScore;
  if (margin === 0) return `${names.team} and ${names.opponent} finish level`;
  const winnerSide = margin > 0 ? "team" : "opponent";
  const winner = margin > 0 ? names.team : names.opponent;
  const loser = margin > 0 ? names.opponent : names.team;

  const plays = scoringPlays(events);
  const wireToWire =
    plays.length > 0 &&
    plays.every((play) => (winnerSide === "team" ? play.team > play.opponent : play.opponent > play.team));
  if (wireToWire) return `${winner} win wire-to-wire`;
  if (Math.abs(margin) <= 3) return `${winner} hold off ${loser}`;

  const run = biggestRuns(events)[winnerSide];
  if (run && run.points >= 10) return `${winner} ride ${run.points}-0 run past ${loser}`;

  const line = lineScore(game, events);
  let best = { period: 0, margin: 0, winner: 0, loser: 0 };
  line.labels.forEach((_, index) => {
    const winnerPoints = (winnerSide === "team" ? line.team[index] : line.opponent[index]) ?? 0;
    const loserPoints = (winnerSide === "team" ? line.opponent[index] : line.team[index]) ?? 0;
    if (winnerPoints - loserPoints > best.margin) best = { period: index + 1, margin: winnerPoints - loserPoints, winner: winnerPoints, loser: loserPoints };
  });
  if (best.period) {
    const verb = best.period <= Math.floor(game.periodCount / 2) ? "take control" : "pull away";
    return `${winner} ${verb} with ${best.winner}-${best.loser} ${periodName(best.period, game.periodCount)}`;
  }
  return `${winner} beat ${loser}`;
}

const at = (event: GameEvent, periodCount: number) => `${periodLabel(event.period, periodCount)} ${formatClock(event.clockSecondsLeft)}`;

/** Three or four moments that tell the story of a final, each pointing at its play. */
export function keyMoments(game: RecapGame, events: GameEvent[], roster: RosterPlayer[], names: { team: string; opponent: string }): KeyMoment[] {
  const moments: KeyMoment[] = [];
  const sideName = (side: "team" | "opponent") => (side === "team" ? names.team : names.opponent);

  const runs = scoringRuns(events);
  const run = runs.reduce<(typeof runs)[number] | null>((best, entry) => (entry.points > (best?.points ?? 0) ? entry : best), null);
  if (run && run.points >= 6) {
    moments.push({
      tag: `${run.points}-0 run`,
      text: `${sideName(run.side)}, ${at(run.start, game.periodCount)} to ${at(run.end, game.periodCount)}`,
      eventId: run.start.id,
    });
  }

  const plays = scoringPlays(events);
  const lastChange = [...plays].reverse().find((play) => play.leadChange);
  if (lastChange) {
    const side = lastChange.team > lastChange.opponent ? "team" : "opponent";
    moments.push({
      tag: "Lead change",
      text: `${sideName(side)} go ahead ${Math.max(lastChange.team, lastChange.opponent)}-${Math.min(lastChange.team, lastChange.opponent)}, ${at(lastChange.event, game.periodCount)}`,
      eventId: lastChange.event.id,
    });
  }

  const top = computeBoxScore(events, roster).players.reduce<ReturnType<typeof computeBoxScore>["players"][number] | null>(
    (best, row) => (row.line.pts > (best?.line.pts ?? 0) ? row : best),
    null,
  );
  if (top) {
    const label = playerLabel({ name: shortName(top.player.name), number: top.player.number });
    moments.push({
      tag: "Top scorer",
      text: `${label} ${top.line.pts} PTS, ${top.line.fgm}-${top.line.fga} FG`,
      playerSlug: top.player.slug,
    });
  }

  const flow = gameFlow(game, events);
  const leadSide = flow.largestLead.team >= flow.largestLead.opponent ? "team" : "opponent";
  const lead = flow.largestLead[leadSide];
  if (lead > 0) {
    const reached = plays.find((play) => (leadSide === "team" ? play.team - play.opponent : play.opponent - play.team) === lead);
    moments.push({
      tag: "Biggest lead",
      text: `${sideName(leadSide)} by ${lead}${reached ? `, ${at(reached.event, game.periodCount)}` : ""}`,
      eventId: reached?.event.id,
    });
  }

  return moments;
}

// ---------------------------------------------------------------------------
// Pre-game
// ---------------------------------------------------------------------------

export type FormResult = { game: GameSummary; result: "W" | "L" | "T" };

/** The team's last `count` finals before `beforeIso`, oldest first. */
export function recentForm(games: GameSummary[], beforeIso: string, count = 5): FormResult[] {
  return games
    .filter((game) => game.status === "final" && game.startsAt < beforeIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(-count)
    .map((game) => ({
      game,
      result: game.teamScore > game.opponentScore ? "W" : game.teamScore < game.opponentScore ? "L" : "T",
    }));
}

/** The most recent final against the same opponent, before this game. */
export function lastMeeting(games: GameSummary[], game: Pick<Game, "id" | "opponentId" | "startsAt">): GameSummary | null {
  return (
    games
      .filter((entry) => entry.id !== game.id && entry.status === "final" && entry.opponentId === game.opponentId && entry.startsAt < game.startsAt)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0] ?? null
  );
}
