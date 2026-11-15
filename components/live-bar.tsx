"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clockSecondsLeft, formatClock, periodLabel } from "@/lib/basketball";
import { teamLabel } from "@/lib/format";
import { getLiveService } from "@/lib/live/use-live-game";
import type { Game, GameSummary } from "@/lib/types";
import { useFlashKey } from "@/lib/use-flash";

/**
 * A score bug under the header on every page while any game is live. It
 * listens to all games, so it appears when the operator starts a game and
 * disappears at the final buzzer without a page reload. It also re-reads the
 * scores when a phone wakes up, so it never sits on an old score.
 */
export function LiveBar({ initial }: { initial: GameSummary[] }) {
  const [games, setGames] = useState<GameSummary[]>(initial);
  const [now, setNow] = useState(() => Date.now());

  const pathname = usePathname();
  // A game page already has its own live connection for that game. Opening a
  // second one there would double the live traffic for every viewer, so on
  // game pages the bar checks for changes every 20 seconds instead.
  const onGamePage = pathname.startsWith("/games/");
  const gamesRef = useRef(games);
  gamesRef.current = games;

  useEffect(() => {
    const service = getLiveService();

    // Re-reads every game in the bar: catches up after the page was rendered,
    // after a phone wakes up, and (on game pages) on a timer.
    const refresh = () => {
      for (const game of gamesRef.current) {
        void service
          .load(game.id)
          .then((snapshot) => {
            if (!snapshot) return;
            setGames((current) =>
              snapshot.game.status === "live"
                ? current.map((entry) => (entry.id === game.id ? snapshot.game : entry))
                : current.filter((entry) => entry.id !== game.id),
            );
          })
          .catch(() => {
            // Offline or a slow network: keep what's shown and try again next time.
          });
      }
    };

    const unsubscribe = onGamePage
      ? null
      : service.subscribeGames((update: Game) => {
          setGames((current) => {
            const known = current.find((game) => game.id === update.id);
            if (update.status !== "live") return known ? current.filter((game) => game.id !== update.id) : current;
            if (known) return current.map((game) => (game.id === update.id ? { ...game, ...update } : game));
            // A game just went live: fetch its team and opponent names.
            void service
              .load(update.id)
              .then((snapshot) => {
                if (snapshot?.game.status === "live") {
                  setGames((latest) => (latest.some((game) => game.id === update.id) ? latest : [...latest, snapshot.game]));
                }
              })
              .catch(() => {});
            return current;
          });
        });

    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = onGamePage ? window.setInterval(refresh, 20_000) : null;

    return () => {
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onVisible);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [onGamePage]);

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
  const teamFlash = useFlashKey(game.teamScore);
  const opponentFlash = useFlashKey(game.opponentScore);
  return (
    <Link href={`/games/${game.id}`} className="live-bar-item">
      <span className="live-tag">Live</span>
      <span className="live-bar-team">{teamLabel(game.team)}</span>
      <span className="live-bar-score">
        Broncos{" "}
        <b key={`t${teamFlash}`} className={teamFlash ? "flash" : ""}>
          {game.teamScore}
        </b>
        <span className="live-bar-dash">–</span>
        <b key={`o${opponentFlash}`} className={opponentFlash ? "flash" : ""}>
          {game.opponentScore}
        </b>{" "}
        {game.opponent.shortName}
      </span>
      {/* The clock ticks from the current time, so server and browser can differ by a second. */}
      <span className="live-bar-clock tabular" suppressHydrationWarning>
        {periodLabel(game.currentPeriod, game.periodCount)} {formatClock(clockSecondsLeft(game, now))}
      </span>
    </Link>
  );
}
