"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clockSecondsLeft, formatClock, periodLabel } from "@/lib/basketball";
import { teamLabel } from "@/lib/format";
import type { GameSummary } from "@/lib/types";
import { useLiveGames } from "./live-games";
import { ScoreRoll } from "./score-roll";

/**
 * A score bug under the header on every page while any game is live. The live
 * games come from LiveGamesProvider. On a game's own page that game is left
 * out (its scoreboard is right there), so the bar only shows other live games.
 */
export function LiveBar() {
  const live = useLiveGames();
  const [now, setNow] = useState(() => Date.now());
  const pathname = usePathname();
  const games = live.filter((game) => pathname !== `/games/${game.id}`);

  const ticking = games.some((game) => game.clockRunning);
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  if (!games.length) return null;

  return (
    <div className="live-bar" role="region" aria-label="Live games">
      <div className="container">
        {games.map((game) => (
          <LiveBarItem key={game.id} game={game} now={now} />
        ))}
      </div>
    </div>
  );
}

function LiveBarItem({ game, now }: { game: GameSummary; now: number }) {
  return (
    <Link href={`/games/${game.id}`} className="live-bar-item">
      <span className="live-tag">Live</span>
      <span className="live-bar-team">{teamLabel(game.team)}</span>
      <span className="live-bar-score">
        Broncos <ScoreRoll value={game.teamScore} compact />
        <span className="live-bar-dash">–</span>
        <ScoreRoll value={game.opponentScore} compact /> {game.opponent.shortName}
      </span>
      {/* The clock ticks from the current time, so server and browser can differ by a second. */}
      <span className="live-bar-clock tabular" suppressHydrationWarning>
        {periodLabel(game.currentPeriod, game.periodCount)} {formatClock(clockSecondsLeft(game, now))}
      </span>
    </Link>
  );
}
