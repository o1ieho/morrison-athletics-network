"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { activeEvents, describeEvent, formatClock, periodLabel, teamFouls } from "@/lib/basketball";
import { formatDateTime, teamLabel } from "@/lib/format";
import type { LiveSnapshot } from "@/lib/live/service";
import { useLiveGame } from "@/lib/live/use-live-game";
import { useFlashKey } from "@/lib/use-flash";
import { Countdown } from "./countdown";

/**
 * The big green scoreboard at the top of the home page. It stays subscribed to
 * the game, so the clock ticks and the score updates live (and an upcoming
 * game flips to live as soon as the operator starts it).
 */
export function FeaturedGame({ initial }: { initial: LiveSnapshot }) {
  const live = useLiveGame(initial.game.id, initial);
  const game = live.game ?? initial.game;
  const isLive = game.status === "live";
  const hasScore = isLive || game.status === "final";

  const players = useMemo(() => new Map(live.roster.map((player) => [player.athleteId, player])), [live.roster]);
  const lastPlay = useMemo(() => [...activeEvents(live.events)].reverse().find((event) => event.side !== "game"), [live.events]);

  const teamFlash = useFlashKey(game.teamScore);
  const opponentFlash = useFlashKey(game.opponentScore);
  const teamLeads = game.teamScore > game.opponentScore;
  const opponentLeads = game.opponentScore > game.teamScore;

  return (
    <Link href={`/games/${game.id}`} className="feature-card">
      <div className="feature-top">
        <span>
          {teamLabel(game.team)} Basketball · {game.isHome ? "Home" : "Away"}
        </span>
        <span>{isLive ? (live.status === "live" ? "Live updates" : "Reconnecting…") : game.location}</span>
      </div>

      <div className="feature-body">
        <div className={`feature-team ${hasScore && opponentLeads ? "trailing" : ""}`}>
          <Image className="feature-mark" src="/brand/broncos-head-cropped.png" alt="" width={72} height={72} priority />
          <span className="feature-name">Broncos</span>
          {hasScore && (
            <span key={teamFlash} className={`feature-score ${teamFlash ? "flash" : ""}`}>
              {game.teamScore}
            </span>
          )}
        </div>

        <div className="feature-center">
          {isLive ? (
            <>
              <span className="badge live">Live</span>
              <span className="feature-period">{periodLabel(game.currentPeriod, game.periodCount)}</span>
              <span className={`feature-clock ${game.clockRunning ? "" : "stopped"}`} suppressHydrationWarning>{formatClock(live.clock)}</span>
              <span className="feature-fouls">
                Fouls {teamFouls(game, live.events, "team")} – {teamFouls(game, live.events, "opponent")}
              </span>
            </>
          ) : game.status === "final" ? (
            <span className="badge final">Final</span>
          ) : (
            <>
              <Countdown to={game.startsAt} />
              <span className="feature-when">{formatDateTime(game.startsAt)}</span>
            </>
          )}
        </div>

        <div className={`feature-team ${hasScore && teamLeads ? "trailing" : ""}`}>
          <span className="feature-mark opponent" aria-hidden="true">
            {game.opponent.shortName.slice(0, 1)}
          </span>
          <span className="feature-name">{game.opponent.shortName}</span>
          {hasScore && (
            <span key={opponentFlash} className={`feature-score ${opponentFlash ? "flash" : ""}`}>
              {game.opponentScore}
            </span>
          )}
        </div>
      </div>

      <div className="feature-bottom">
        <span className="feature-last">
          {isLive && lastPlay
            ? `${periodLabel(lastPlay.period, game.periodCount)} ${formatClock(lastPlay.clockSecondsLeft)} · ${describeEvent(lastPlay, {
                team: "Broncos",
                opponent: game.opponent.shortName,
                player: lastPlay.athleteId ? players.get(lastPlay.athleteId) : undefined,
                periodCount: game.periodCount,
              })}`
            : isLive
              ? "Tip-off"
              : game.status === "final"
                ? "Box score, shot chart and play-by-play"
                : "Game preview and roster"}
        </span>
        <span className="feature-cta">{isLive ? "Follow live" : game.status === "final" ? "Recap" : "Details"} →</span>
      </div>
    </Link>
  );
}
