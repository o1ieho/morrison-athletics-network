import Link from "next/link";
import { formatShortDay, formatTime, matchupLabel, resultLetter, teamLabel } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

export function StatusBadge({ game }: { game: Pick<GameSummary, "status"> }) {
  switch (game.status) {
    case "live":
      return <span className="badge live">Live</span>;
    case "final":
      return <span className="badge final">Final</span>;
    case "postponed":
      return <span className="badge muted">Postponed</span>;
    case "canceled":
      return <span className="badge muted">Canceled</span>;
    default:
      return null;
  }
}

function dayParts(iso: string) {
  const [month, day] = formatShortDay(iso).split(" ");
  return { month, day };
}

/** One game in a list: date, matchup, then the score or start time. */
export function GameRow({ game, showTeam = true }: { game: GameSummary; showTeam?: boolean }) {
  const { month, day } = dayParts(game.startsAt);
  const result = resultLetter(game);
  const hasScore = game.status === "live" || game.status === "final";

  return (
    <Link href={`/games/${game.id}`} className="game-row">
      <span className="game-date">
        <span>{month}</span>
        <strong>{day}</strong>
      </span>
      <span className="game-main">
        <strong>
          {game.isHome ? "vs" : "at"} {game.opponent.name}
        </strong>
        <span>
          {showTeam ? `${teamLabel(game.team)} · ` : ""}
          {game.location || (game.isHome ? "Home" : "Away")}
        </span>
      </span>
      <span className="game-side">
        {hasScore ? (
          <span className="game-score tabular">
            {result && <span className={`result ${result}`}>{result} </span>}
            {game.teamScore}–{game.opponentScore}
          </span>
        ) : (
          <span className="game-score small">{formatTime(game.startsAt)}</span>
        )}
        <StatusBadge game={game} />
      </span>
    </Link>
  );
}

export { matchupLabel };
