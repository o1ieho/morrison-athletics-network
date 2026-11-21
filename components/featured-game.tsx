"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { activeEvents, describeEvent, formatClock, periodLabel, teamFouls } from "@/lib/basketball";
import { formatDateTime, teamLabel } from "@/lib/format";
import { currentRun } from "@/lib/game-analysis";
import type { LiveSnapshot } from "@/lib/live/service";
import { useLiveGame } from "@/lib/live/use-live-game";
import { recapHeadline, type FormResult } from "@/lib/recap";
import { useCatchUp } from "@/lib/use-catch-up";
import { ConnectionNote } from "./connection-note";
import { Countdown } from "./countdown";
import { LiveAnnouncer } from "./live-announcer";
import { RunStrip } from "./run-strip";
import { ScoreRoll } from "./score-roll";

/**
 * The big green scoreboard at the top of the home page. It stays subscribed to
 * the game, so the clock ticks and the score updates live (and an upcoming
 * game flips to live as soon as the operator starts it). The bottom line shows
 * a run in progress or the last play while live, the recap headline for a
 * final, and the team's form before an upcoming game.
 */
export function FeaturedGame({ initial, form = [] }: { initial: LiveSnapshot; form?: FormResult[] }) {
  const live = useLiveGame(initial.game.id, initial);
  useCatchUp(live.status);
  const game = live.game ?? initial.game;
  const isLive = game.status === "live";
  const hasScore = isLive || game.status === "final";
  const names = { team: "Broncos", opponent: game.opponent.shortName };

  const players = useMemo(() => new Map(live.roster.map((player) => [player.athleteId, player])), [live.roster]);
  const lastPlay = useMemo(() => [...activeEvents(live.events)].reverse().find((event) => event.side !== "game"), [live.events]);
  const run = useMemo(() => (isLive ? currentRun(live.events) : null), [isLive, live.events]);
  const headline = useMemo(
    () => (game.status === "final" ? recapHeadline(game, live.events, { team: "Broncos", opponent: game.opponent.shortName }) : null),
    [game, live.events],
  );

  const teamLeads = game.teamScore > game.opponentScore;
  const opponentLeads = game.opponentScore > game.teamScore;
  const foulPeriod = game.foulReset === "half" && game.periodCount === 4 ? (game.currentPeriod <= 2 ? "1st half" : "2nd half") : periodLabel(game.currentPeriod, game.periodCount);

  return (
    <>
      {/* Outside the link, so announcements don't become part of its name. */}
      <LiveAnnouncer game={game} events={live.events} clock={live.clock} />
      <Link href={`/games/${game.id}`} className="feature-card">
        <div className="feature-top">
          <span>
            {teamLabel(game.team)} Basketball · {game.isHome ? "Home" : "Away"}
          </span>
          <span>{isLive ? <ConnectionNote status={live.status} /> : game.location}</span>
        </div>

        <div className="feature-body">
          <div className={`feature-team ${hasScore && opponentLeads ? "trailing" : ""}`}>
            <Image className="feature-mark" src="/brand/broncos-head-cropped.png" alt="" width={72} height={72} priority />
            <span className="feature-name">Broncos</span>
            {hasScore && <ScoreRoll value={game.teamScore} className="feature-score" tag="end" />}
          </div>

          <div className="feature-center">
            {isLive ? (
              <>
                <span className="badge live">Live</span>
                <span className="feature-period">{periodLabel(game.currentPeriod, game.periodCount)}</span>
                <span className={`feature-clock ${game.clockRunning ? "" : "stopped"}`} suppressHydrationWarning>
                  {formatClock(live.clock)}
                </span>
                {/* Always rendered so the board doesn't change height when the clock starts. */}
                <span className={`gc-stopped ${game.clockRunning ? "hidden" : ""}`}>Stopped</span>
                <span className="feature-fouls">
                  {foulPeriod} fouls {teamFouls(game, live.events, "team")} – {teamFouls(game, live.events, "opponent")}
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
            {hasScore && <ScoreRoll value={game.opponentScore} className="feature-score" tag="start" />}
          </div>
        </div>

        <div className="feature-bottom">
          {run ? (
            <RunStrip run={run} names={names} periodCount={game.periodCount} className="in-feature" />
          ) : (
            <span className="feature-last">
              {isLive && lastPlay ? (
                `${periodLabel(lastPlay.period, game.periodCount)} ${formatClock(lastPlay.clockSecondsLeft)} · ${describeEvent(lastPlay, {
                  team: "Broncos",
                  opponent: game.opponent.shortName,
                  player: lastPlay.athleteId ? players.get(lastPlay.athleteId) : undefined,
                  periodCount: game.periodCount,
                })}`
              ) : isLive ? (
                "Tip-off"
              ) : headline ? (
                <span className="feature-headline">{headline}</span>
              ) : form.length ? (
                <span className="feature-form">
                  Form
                  {form.map(({ game: result, result: letter }) => (
                    <span key={result.id} className={`form-tile small ${letter}`} title={`${result.teamScore}–${result.opponentScore} vs ${result.opponent.shortName}`}>
                      {letter}
                    </span>
                  ))}
                </span>
              ) : (
                "Game preview and roster"
              )}
            </span>
          )}
          <span className="feature-cta">{isLive ? "Follow live" : game.status === "final" ? "Recap" : "Details"} →</span>
        </div>
      </Link>
    </>
  );
}
