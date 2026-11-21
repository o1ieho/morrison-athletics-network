import { periodLabel } from "@/lib/basketball";
import { formatDateTime, matchupLabel, teamLabel } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

/**
 * The one-line summary a shared game link shows (LINE, WhatsApp, iMessage):
 * "Broncos 39–35 Huskies · Live, Q3", "Broncos 51–52 Knights · Final", or the
 * tip-off time for a game that hasn't started.
 */
export function shareSummary(game: GameSummary) {
  const score = `Broncos ${game.teamScore}–${game.opponentScore} ${game.opponent.shortName}`;
  switch (game.status) {
    case "live":
      return `${score} · Live, ${periodLabel(game.currentPeriod, game.periodCount)}`;
    case "final":
      return `${score} · Final`;
    case "postponed":
      return `${matchupLabel(game)} · Postponed`;
    case "canceled":
      return `${matchupLabel(game)} · Canceled`;
    default:
      return `${matchupLabel(game)} · ${formatDateTime(game.startsAt)}`;
  }
}

/**
 * The preview image's address. It carries the score and status, so when the
 * score changes the link gets a new image: apps cache previews by address,
 * and would otherwise keep showing the score from the first share.
 */
export function shareImagePath(game: GameSummary) {
  const version = `${game.status}-${game.teamScore}-${game.opponentScore}-${game.currentPeriod}`;
  return `/api/og/game/${encodeURIComponent(game.id)}?v=${encodeURIComponent(version)}`;
}

export function shareTitle(game: GameSummary) {
  return `${matchupLabel(game)} (${teamLabel(game.team)})`;
}
