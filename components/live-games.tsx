"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getLiveService } from "@/lib/live/use-live-game";
import type { Game, GameSummary } from "@/lib/types";

const LiveGamesContext = createContext<GameSummary[]>([]);

/** The games live right now, for the live bar and the header's "Live" link. */
export function useLiveGames() {
  return useContext(LiveGamesContext);
}

/**
 * Keeps the list of live games current on every page. It listens to all
 * games, so a game appears when the operator starts it and disappears at the
 * final buzzer without a page reload. It also re-reads the scores when a phone
 * wakes up, so the bar never sits on an old score. The header and the live bar
 * share this one connection.
 */
export function LiveGamesProvider({ initial, children }: { initial: GameSummary[]; children: React.ReactNode }) {
  const [games, setGames] = useState<GameSummary[]>(initial);

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

  return <LiveGamesContext.Provider value={games}>{children}</LiveGamesContext.Provider>;
}
