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

/** Compact horizontal ticker of games under the header. */
export function ScoreStrip({ games }: { games: GameSummary[] }) {
  if (!games.length) return null;
  return (
    <div className="score-strip" aria-label="Scores">
      <div className="container">
        {games.map((game) => {
          const started = game.status === "live" || game.status === "final";
          const status =
            game.status === "live" ? "Live" : game.status === "final" ? "Final" : `${formatShortDay(game.startsAt)} · ${formatTime(game.startsAt)}`;
          const teamLost = game.status === "final" && game.teamScore < game.opponentScore;
          const opponentLost = game.status === "final" && game.opponentScore < game.teamScore;
          return (
            <Link key={game.id} href={`/games/${game.id}`} className="strip-game">
              <span className={`strip-status ${game.status === "live" ? "live" : ""}`}>
                {teamLabel(game.team)} · {status}
              </span>
              <span className={`strip-row ${teamLost ? "lost" : ""}`}>
                <span>Broncos</span>
                <span className="tabular">{started ? game.teamScore : ""}</span>
              </span>
              <span className={`strip-row ${opponentLost ? "lost" : ""}`}>
                <span>{game.opponent.shortName}</span>
                <span className="tabular">{started ? game.opponentScore : ""}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Live games first, then the latest results, then what's next. */
export function stripGames(games: GameSummary[], now = Date.now()) {
  const live = games.filter((game) => game.status === "live");
  const recent = games
    .filter((game) => game.status === "final")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 4);
  const upcoming = games.filter((game) => game.status === "scheduled" && Date.parse(game.startsAt) >= now - 3 * 3600_000).slice(0, 4);
  return [...live, ...recent, ...upcoming];
}

export { matchupLabel };
