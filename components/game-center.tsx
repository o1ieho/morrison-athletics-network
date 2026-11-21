"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Countdown } from "@/components/countdown";
import { ConnectionNote } from "@/components/connection-note";
import { Court, CourtLegend } from "@/components/court";
import { GameRecap, OPEN_PLAY_EVENT } from "@/components/game-recap";
import { LiveAnnouncer } from "@/components/live-announcer";
import { useReportLiveGame } from "@/components/live-games";
import { PreGame, type GamePreview } from "@/components/pregame";
import { ScoreRoll } from "@/components/score-roll";
import { GameFlowChart, LeadStrip } from "@/components/stats/game-flow";
import { ZoneChart, ZoneLegend } from "@/components/stats/zone-chart";
import { TableScroll } from "@/components/table-scroll";
import {
  EVENT_META,
  activeEvents,
  computeBoxScore,
  describeEvent,
  formatClock,
  percentage,
  periodLabel,
  playerLabel,
  shortName,
  teamFouls,
  timeoutsUsed,
  type BoxScore,
} from "@/lib/basketball";
import { formatDateTime, matchupLabel, teamLabel } from "@/lib/format";
import {
  annotatePlays,
  biggestRuns,
  elapsedSeconds,
  gameFlow,
  lineScore,
  scoringRuns,
  timeLeading,
  zoneStats,
  type LineScore,
} from "@/lib/game-analysis";
import type { ConnectionStatus, LiveSnapshot } from "@/lib/live/service";
import { useLiveGame } from "@/lib/live/use-live-game";
import { keyMoments, recapHeadline } from "@/lib/recap";
import type { GameEvent, GameSummary, RosterPlayer, StatLine } from "@/lib/types";
import { sortArrivals } from "@/lib/catch-up";
import { useCatchUp, isCatchingUp } from "@/lib/use-catch-up";
import { useFlashKey } from "@/lib/use-flash";
import { useHydrated } from "@/lib/use-hydrated";

/** Runs at least this big are shaded on the lead tracker. */
const SHADED_RUN = 8;
/** The play-by-play shows this many rows until "Show all" is tapped. */
const FEED_LIMIT = 30;
/** How many plays the Gamecast tab shows under the court. */
const RECENT_PLAYS = 6;

type GameTab = "gamecast" | "box" | "plays" | "stats";
const GAME_TABS: Array<[GameTab, string]> = [
  ["gamecast", "Gamecast"],
  ["box", "Box Score"],
  ["plays", "Play-by-Play"],
  ["stats", "Team Stats"],
];

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The game page, laid out like ESPN's: a compact scoreboard with the line
 * score, then tabs. "Gamecast" shows just enough to follow the game (the
 * court, the latest plays, the top Broncos and a small game-flow chart); the
 * full play-by-play, box score and team stats each have their own tab. A
 * final leads with a recap; an upcoming game shows season leaders, form and
 * the roster.
 */
export function GameCenter({ initial, preview }: { initial: LiveSnapshot; preview?: GamePreview }) {
  const live = useLiveGame(initial.game.id, initial);
  useCatchUp(live.status);
  const game = live.game ?? initial.game;
  // Keeps the header's Live link right without the provider re-reading this game.
  useReportLiveGame(game);
  const roster = live.roster;
  const events = live.events;
  const names = useMemo(() => ({ team: "Broncos", opponent: game.opponent.shortName }), [game.opponent.shortName]);

  const box = useMemo(() => computeBoxScore(events, roster), [events, roster]);
  const line = useMemo(() => lineScore(game, events), [game, events]);
  const flow = useMemo(() => gameFlow(game, events), [game, events]);
  const runs = useMemo(() => scoringRuns(events), [events]);
  const biggest = useMemo(() => {
    const best = biggestRuns(events);
    return best.team && best.opponent ? (best.team.points >= best.opponent.points ? best.team : best.opponent) : (best.team ?? best.opponent);
  }, [events]);
  const recap = useMemo(
    () => (game.status === "final" ? { headline: recapHeadline(game, events, names), moments: keyMoments(game, events, roster, names) } : null),
    [game, events, roster, names],
  );

  const isLive = game.status === "live";
  const started = isLive || game.status === "final" || activeEvents(events).length > 0;
  // Changes once if the game tips off while the page is open, to crossfade the layout.
  const tipped = useFlashKey(started);
  const [tab, setTab] = useState<GameTab>("gamecast");
  const tabsRef = useRef<HTMLDivElement>(null);
  // A recap link or #play-… URL opens the play-by-play tab (the panel itself scrolls to the play).
  useEffect(() => {
    const toPlays = () => setTab("plays");
    const fromHash = () => {
      if (window.location.hash.startsWith("#play-")) toPlays();
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener(OPEN_PLAY_EVENT, toPlays);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener(OPEN_PLAY_EVENT, toPlays);
    };
  }, []);
  const openPlays = () => {
    setTab("plays");
    tabsRef.current?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  // Game time for the lead tracker, in 15-second steps so the chart doesn't redraw every tick.
  // It depends on the current time, so the server and the first browser render stop at the last score.
  const hydrated = useHydrated();
  const lastT = flow.points[flow.points.length - 1].t;
  const nowT = isLive
    ? hydrated
      ? Math.max(lastT, Math.floor(elapsedSeconds(game, game.currentPeriod, live.clock) / 15) * 15)
      : lastT
    : undefined;
  const shaded = runs
    .filter((entry) => entry.points >= SHADED_RUN)
    .map((entry) => ({
      id: entry.start.id,
      startT: elapsedSeconds(game, entry.start.period, entry.start.clockSecondsLeft),
      endT: elapsedSeconds(game, entry.end.period, entry.end.clockSecondsLeft),
    }));

  return (
    <div className="stack">
      <LiveAnnouncer game={game} events={events} clock={live.clock} />
      <Scoreboard game={game} events={events} clock={live.clock} status={live.status} line={started ? line : null} />

      <div key={tipped} className={`stack ${tipped ? "gc-swap" : ""}`}>
        {started ? (
          <>
            {/* Toggle buttons rather than ARIA tabs: no arrow-key tab pattern is promised. */}
            <div className="tabs gc-tabs" role="group" aria-label="Game sections" ref={tabsRef}>
              {GAME_TABS.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>

            {/* Every tab stays mounted (hidden when not chosen) so filters and scroll positions survive switching. */}
            <div hidden={tab !== "gamecast"} className="stack">
              {recap && <GameRecap recap={recap} />}
              <div className="gc-grid">
                <div className="gc-main">
                  <ShotPanel game={game} events={events} roster={roster} />
                  <RecentPlays game={game} events={events} roster={roster} onShowAll={openPlays} />
                </div>
                <aside className="gc-side">
                  <TopPerformers box={box} onShowBox={() => setTab("box")} />
                  <LeadStrip compact flow={flow} game={game} opponentName={names.opponent} nowT={nowT} runs={shaded} leading={timeLeading(flow, nowT ?? flow.duration)} />
                </aside>
              </div>
            </div>
            <div hidden={tab !== "box"}>
              <BoxScoreTable game={game} box={box} />
            </div>
            <div hidden={tab !== "plays"}>
              <PlaysPanel game={game} events={events} roster={roster} />
            </div>
            <div hidden={tab !== "stats"} className="gc-stats-tab">
              <TeamStatsPanel game={game} box={box} events={events} line={line} />
              <section className="card card-pad" aria-label="Lead tracker">
                <GameFlowChart flow={flow} game={game} opponentName={names.opponent} nowT={nowT} biggestRun={biggest} />
              </section>
            </div>
          </>
        ) : (
          <>
            {preview && <PreGame game={game} roster={roster} preview={preview} />}
            <section>
              <div className="section-head">
                <h2>Roster</h2>
              </div>
              <RosterList roster={roster} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Scoreboard

function Scoreboard({
  game,
  events,
  clock,
  status,
  line,
}: {
  game: GameSummary;
  events: GameEvent[];
  clock: number;
  status: ConnectionStatus;
  line: LineScore | null;
}) {
  const isLive = game.status === "live";
  const hasScore = isLive || game.status === "final";
  const teamFoulCount = teamFouls(game, events, "team");
  const opponentFoulCount = teamFouls(game, events, "opponent");
  const foulLabel = `${game.foulReset === "half" && game.periodCount === 4 ? (game.currentPeriod <= 2 ? "1st half" : "2nd half") : periodLabel(game.currentPeriod, game.periodCount)} fouls`;
  const team = {
    name: "Broncos",
    score: game.teamScore,
    side: game.isHome ? "Home" : "Away",
    fouls: teamFoulCount,
    timeouts: timeoutsUsed(events, "team"),
    bonus: opponentFoulCount >= game.bonusThreshold,
    trailing: hasScore && game.teamScore < game.opponentScore,
  };
  const opponent = {
    name: game.opponent.shortName,
    score: game.opponentScore,
    side: game.isHome ? "Away" : "Home",
    fouls: opponentFoulCount,
    timeouts: timeoutsUsed(events, "opponent"),
    bonus: teamFoulCount >= game.bonusThreshold,
    trailing: hasScore && game.opponentScore < game.teamScore,
  };
  const current = isLive ? game.currentPeriod - 1 : -1;
  const total = (values: Array<number | null>) => values.reduce<number>((sum, value) => sum + (value ?? 0), 0);

  return (
    <section className="gc-board" aria-label="Scoreboard">
      {/* The page's main heading, for screen readers: the board shows the same thing visually. */}
      <h1 className="visually-hidden">
        {matchupLabel(game)}, {teamLabel(game.team)}
      </h1>
      <div className="gc-board-meta">
        <span className="gc-meta-text">
          {teamLabel(game.team)} · {formatDateTime(game.startsAt)}
          {game.location ? ` · ${game.location}` : ""}
        </span>
        {isLive && <ConnectionNote status={status} />}
      </div>

      <div className="gc-board-body">
        <div className="gc-matchup">
          <TeamScore
            team={team}
            foulLabel={foulLabel}
            mark={<Image className="gc-mark" src="/brand/broncos-head-cropped.png" alt="" width={56} height={56} priority />}
            hasScore={hasScore}
            showFouls={isLive}
          />

          <div className="gc-status">
            {isLive ? (
              <>
                <span className="badge live">Live</span>
                <span className="gc-period">{periodLabel(game.currentPeriod, game.periodCount)}</span>
                <span className={`gc-clock ${game.clockRunning ? "" : "stopped"}`} suppressHydrationWarning>
                  {formatClock(clock)}
                </span>
                {/* Always rendered so the board doesn't change height when the clock starts. */}
                <span className={`gc-stopped ${game.clockRunning ? "hidden" : ""}`}>Stopped</span>
              </>
            ) : game.status === "final" ? (
              <>
                <span className="badge final">Final</span>
                {game.currentPeriod > game.periodCount && <span className="gc-period">{periodLabel(game.currentPeriod, game.periodCount)}</span>}
              </>
            ) : game.status === "scheduled" ? (
              <Countdown to={game.startsAt} />
            ) : (
              <span className="badge muted">{game.status}</span>
            )}
          </div>

          <TeamScore
            team={opponent}
            foulLabel={foulLabel}
            mark={
              <span className="gc-mark opponent" aria-hidden="true">
                {game.opponent.shortName.slice(0, 1)}
              </span>
            }
            hasScore={hasScore}
            showFouls={isLive}
            reverse
          />
        </div>

        {line && (
          <div className="gc-line">
            <table>
              <thead>
                <tr>
                  <th />
                  {line.labels.map((label, index) => (
                    <th key={label} className={index === current ? "current" : undefined}>
                      {label}
                    </th>
                  ))}
                  <th>T</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Broncos", line.team],
                    [game.opponent.shortName, line.opponent],
                  ] as const
                ).map(([name, values]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    {values.map((value, index) => (
                      <td key={line.labels[index]} className={index === current ? "current" : value === null ? "future" : undefined}>
                        {value ?? "–"}
                      </td>
                    ))}
                    <td className="total">{total(values)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

type TeamSide = {
  name: string;
  score: number;
  side: string;
  fouls: number;
  timeouts: number;
  bonus: boolean;
  trailing: boolean;
};

function TeamScore({
  team,
  foulLabel,
  mark,
  hasScore,
  showFouls,
  reverse = false,
}: {
  team: TeamSide;
  foulLabel: string;
  mark: React.ReactNode;
  hasScore: boolean;
  showFouls: boolean;
  reverse?: boolean;
}) {
  // The bonus chip fades in when it starts during the game, not on page load.
  const bonusChanged = useFlashKey(team.bonus);
  return (
    <div className={`gc-team ${reverse ? "reverse" : ""} ${team.trailing ? "trailing" : ""}`}>
      {mark}
      <span className="gc-team-text">
        <strong>{team.name}</strong>
        <span>
          {team.side}
          {showFouls && ` · ${foulLabel} ${team.fouls} · TO ${team.timeouts}`}
          {showFouls && team.bonus && <span className={`bonus ${bonusChanged ? "appear" : ""}`}>Bonus</span>}
        </span>
      </span>
      {/* The "+3" tag sits on the side facing the clock. */}
      {hasScore && <ScoreRoll value={team.score} className="gc-score" tag={reverse ? "start" : "end"} />}
    </div>
  );
}

// ---------------------------------------------------------------- New plays

/** How long a new row counts as new: its slide-in plus the yellow hold and fade. */
const FRESH_ROW_MS = 2000;

/**
 * Which plays arrived live, for the "new play" animation. Plays on screen at
 * load don't count, and neither do batches (a phone waking up, a reconnect):
 * those are added quietly. A play stays new for `freshMs`, so changing a
 * filter later doesn't replay its animation.
 */
function useArrivals(events: GameEvent[], freshMs: number) {
  const known = useRef<Set<string> | null>(null);
  const arrivedAt = useRef(new Map<string, number>());
  const ids = events.map((event) => event.id);
  const now = Date.now();
  // Recorded during render (idempotent: a second render finds nothing new) so
  // the very first paint of a new row already has its class.
  if (known.current === null) {
    known.current = new Set(ids);
  } else {
    const { fresh, settled } = sortArrivals(known.current, ids, isCatchingUp(now));
    for (const id of settled) known.current.add(id);
    for (const id of fresh) {
      known.current.add(id);
      arrivedAt.current.set(id, now);
    }
  }
  return (id: string) => {
    const at = arrivedAt.current.get(id);
    return at !== undefined && now - at < freshMs;
  };
}

// ---------------------------------------------------------------- Shot chart panel

function ShotPanel({ game, events, roster }: { game: GameSummary; events: GameEvent[]; roster: RosterPlayer[] }) {
  const [playerId, setPlayerId] = useState("all");
  const [view, setView] = useState<"shots" | "zones">("shots");
  const players = useMemo(() => new Map(roster.map((player) => [player.athleteId, player])), [roster]);

  const active = activeEvents(events);
  // Every Broncos shot stays on the court; picking a player fades the others back.
  const shots = active.filter(
    (event) => event.side === "team" && event.shotX !== null && event.shotY !== null && EVENT_META[event.type].isFieldGoal,
  );
  // Shots on the court when the page loaded (or caught up in a batch) don't animate.
  const isFresh = useArrivals(shots, 1000);
  const selected = shots.filter((shot) => playerId === "all" || shot.athleteId === playerId);
  const shooters = roster.filter((player) => shots.some((shot) => shot.athleteId === player.athleteId));
  const made = selected.filter((shot) => EVENT_META[shot.type].made).length;
  const lastPlay = [...active].reverse().find((event) => event.side !== "game");
  const latestShotId = selected[selected.length - 1]?.id;

  return (
    <section className="card gc-panel" aria-label="Shot chart">
      {lastPlay && (
        <div className="gc-last-play">
          <span className="gc-last-label">Last play</span>
          <span>
            <span className="muted">
              {periodLabel(lastPlay.period, game.periodCount)} {formatClock(lastPlay.clockSecondsLeft)} ·{" "}
            </span>
            {describeEvent(lastPlay, {
              team: "Broncos",
              opponent: game.opponent.shortName,
              player: lastPlay.athleteId ? players.get(lastPlay.athleteId) : undefined,
              periodCount: game.periodCount,
            })}
          </span>
        </div>
      )}
      <div className="gc-panel-head">
        <h2>Shot chart</h2>
        <span className="muted small tabular">
          {made}/{selected.length} · {percentage(made, selected.length)}
        </span>
      </div>
      <div className="gc-controls">
        <div className="tabs small" role="group" aria-label="Shot chart view">
          {(["shots", "zones"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}>
              {option === "shots" ? "Every shot" : "By zone"}
            </button>
          ))}
        </div>
        <label>
          <span className="visually-hidden">Player</span>
          <select className="gc-select" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
            <option value="all">All Broncos</option>
            {shooters.map((player) => (
              <option key={player.athleteId} value={player.athleteId}>
                {playerLabel(player)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* Both views share one grid cell and crossfade. */}
      <div className="gc-court gc-views">
        <div className="gc-view" data-active={view === "shots"}>
          <Court
            shots={shots.map((shot) => ({
              id: shot.id,
              x: shot.shotX!,
              y: shot.shotY!,
              made: EVENT_META[shot.type].made,
              latest: shot.id === latestShotId,
              fresh: isFresh(shot.id),
              dim: playerId !== "all" && shot.athleteId !== playerId,
              label: `${EVENT_META[shot.type].label} · ${periodLabel(shot.period)} ${formatClock(shot.clockSecondsLeft)}`,
            }))}
          />
        </div>
        <div className="gc-view" data-active={view === "zones"}>
          {/* Keyed on the player so switching players doesn't flash every zone. */}
          <ZoneChart key={playerId} stats={zoneStats(events, playerId === "all" ? undefined : playerId)} />
        </div>
      </div>
      <div className="gc-panel-foot">
        {!shots.length && <p className="muted small gc-court-empty">No shots yet</p>}
        {view === "shots" ? <CourtLegend /> : <ZoneLegend />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Play-by-play panel

function PlaysPanel({ game, events, roster }: { game: GameSummary; events: GameEvent[]; roster: RosterPlayer[] }) {
  const players = useMemo(() => new Map(roster.map((player) => [player.athleteId, player])), [roster]);
  const [period, setPeriod] = useState<number | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [unseen, setUnseen] = useState(0);
  const feed = useRef<HTMLOListElement>(null);
  // Plays present when the page loaded, or caught up in a batch, don't animate.
  const isFresh = useArrivals(events, FRESH_ROW_MS);

  const notes = useMemo(() => annotatePlays(events), [events]);
  // Newest first.
  const rows = useMemo(() => activeEvents(events).reverse(), [events]);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const periods = [...new Set(rows.map((event) => event.period))].sort((a, b) => a - b);
  const filtered = rows.filter(
    (event) =>
      period === "all" || event.period === period,
  );
  const shown = showAll ? filtered : filtered.slice(0, FEED_LIMIT);

  // A recap link (#play-…, or a repeat click on one) opens the feed on that
  // play's quarter and scrolls to it.
  const [jumps, setJumps] = useState(0);
  useEffect(() => {
    const open = (id: string) => {
      const event = rowsRef.current.find((entry) => entry.id === id);
      if (!event) return;
      setPeriod(event.period);
      setShowAll(true);
      setTarget(event.id);
      setJumps((count) => count + 1);
    };
    const fromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash.startsWith("play-")) open(hash.slice(5));
    };
    const fromLink = (event: Event) => open((event as CustomEvent<string>).detail);
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener(OPEN_PLAY_EVENT, fromLink);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener(OPEN_PLAY_EVENT, fromLink);
    };
  }, []);
  useEffect(() => {
    if (target) document.getElementById(`play-${target}`)?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [target, jumps]);

  // Scrolled down the feed: new plays don't push what you're reading; a button offers them instead.
  const count = useRef(rows.length);
  useEffect(() => {
    const added = rows.length - count.current;
    count.current = rows.length;
    if (added > 0 && (feed.current?.scrollTop ?? 0) > 40) setUnseen((current) => current + added);
  }, [rows.length]);

  const names = { team: "Broncos", opponent: game.opponent.shortName, periodCount: game.periodCount };
  const filterButton = (active: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <section className="card gc-panel gc-plays" aria-label="Play-by-play">
      <div className="gc-panel-head">
        <h2>Play-by-play</h2>
      </div>
      <div className="gc-feed-filters">
        <div className="segments" role="group" aria-label="Quarter">
          {(["all", ...periods] as const).map((option) =>
            filterButton(period === option, option === "all" ? "All Qs" : periodLabel(option, game.periodCount), () => setPeriod(option)),
          )}
        </div>
      </div>
      <div className="gc-feed-wrap">
        {unseen > 0 && (
          <button
            type="button"
            className="feed-new"
            onClick={() => {
              feed.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
              setUnseen(0);
            }}
          >
            {unseen} new {unseen === 1 ? "play" : "plays"} ↑
          </button>
        )}
        <ol
          className="gc-feed"
          ref={feed}
          onScroll={(event) => {
            if (unseen && event.currentTarget.scrollTop <= 40) setUnseen(0);
          }}
        >
          {shown.map((event) => {
            const note = notes.get(event.id);
            const fresh = isFresh(event.id);
            const highlight = `${fresh ? "pbp-new" : ""} ${event.id === target ? "target" : ""}`;
            if (event.type === "period_end" && note) {
              const leader =
                note.team > note.opponent
                  ? `Broncos ${note.team}–${note.opponent}`
                  : note.opponent > note.team
                    ? `${game.opponent.shortName} ${note.opponent}–${note.team}`
                    : `Tied ${note.team}–${note.opponent}`;
              return (
                <li key={event.id} id={`play-${event.id}`} className={`gc-feed-chapter ${highlight}`}>
                  End of {periodLabel(event.period, game.periodCount)} · {leader}
                </li>
              );
            }
            if (event.side === "game") {
              return (
                <li key={event.id} id={`play-${event.id}`} className="gc-feed-marker">
                  {describeEvent(event, names)}
                </li>
              );
            }
            const scoring = event.points > 0;
            return (
              <li key={event.id} id={`play-${event.id}`} className={`gc-feed-row ${event.side} ${scoring ? "scoring" : ""} ${highlight}`}>
                <span className="gc-feed-time">
                  {period === "all" && <b>{periodLabel(event.period, game.periodCount)}</b>} {formatClock(event.clockSecondsLeft)}
                </span>
                <span className="gc-feed-text">
                  {describeEvent(event, { ...names, player: event.athleteId ? players.get(event.athleteId) : undefined })}
                  {note?.leadChange && <span className="tag lead">Lead change</span>}
                  {note?.tie && <span className="tag tie">Tied</span>}
                  {note?.run && <span className="tag run">{note.run.points}-0 run</span>}
                  {note?.milestone && <span className="tag plain">{note.milestone} pts</span>}
                </span>
                <span className="gc-feed-score">
                  {scoring && note && (
                    <>
                      {event.side === "team" ? <b>{note.team}</b> : note.team}–{event.side === "opponent" ? <b>{note.opponent}</b> : note.opponent}
                    </>
                  )}
                </span>
              </li>
            );
          })}
          {!shown.length && (
            <li className="gc-feed-empty">
              {rows.length ? "No plays in this quarter yet." : "Plays appear here as soon as the game tips off."}
            </li>
          )}
          {!showAll && filtered.length > FEED_LIMIT && (
            <li className="gc-feed-more">
              <button type="button" onClick={() => setShowAll(true)}>
                Show all {filtered.length} plays
              </button>
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Side column

/** ESPN-style headline for a play: "+3 Points", "Rebound", "Foul". */
function playHeadline(event: GameEvent) {
  const meta = EVENT_META[event.type];
  if (event.points > 0) return `+${event.points} ${event.points === 1 ? "Point" : "Points"}`;
  if (meta.isShot) return "Missed shot";
  return meta.label;
}

/** The latest few plays under the court, newest first, with a way into the full feed. */
function RecentPlays({
  game,
  events,
  roster,
  onShowAll,
}: {
  game: GameSummary;
  events: GameEvent[];
  roster: RosterPlayer[];
  onShowAll: () => void;
}) {
  const players = useMemo(() => new Map(roster.map((player) => [player.athleteId, player])), [roster]);
  const isFresh = useArrivals(events, FRESH_ROW_MS);
  const notes = useMemo(() => annotatePlays(events), [events]);
  const plays = activeEvents(events)
    .filter((event) => event.side !== "game")
    .reverse()
    .slice(0, RECENT_PLAYS);
  const names = { team: "Broncos", opponent: game.opponent.shortName, periodCount: game.periodCount };

  return (
    <section className="card gc-panel gc-recent" aria-label="Recent plays">
      <div className="gc-panel-head">
        <h2>Recent plays</h2>
      </div>
      <ol className="gc-recent-list">
        {plays.map((event) => {
          const note = notes.get(event.id);
          return (
            <li key={event.id} className={`gc-recent-play ${event.side} ${isFresh(event.id) ? "pbp-new" : ""}`}>
              <span className="gc-recent-main">
                <strong>{playHeadline(event)}</strong>
                <span className="gc-recent-time">
                  {periodLabel(event.period, game.periodCount)} · {formatClock(event.clockSecondsLeft)}
                </span>
                <span className="gc-recent-text">
                  {describeEvent(event, { ...names, player: event.athleteId ? players.get(event.athleteId) : undefined })}
                  {note?.run && <span className="tag run">{note.run.points}-0 run</span>}
                </span>
              </span>
              {note && (
                <span className="gc-recent-score tabular">
                  {event.side === "team" ? <b>{note.team}</b> : note.team}–{event.side === "opponent" ? <b>{note.opponent}</b> : note.opponent}
                </span>
              )}
            </li>
          );
        })}
        {!plays.length && <li className="gc-feed-empty">Plays appear here as soon as the game tips off.</li>}
      </ol>
      <button type="button" className="gc-more" onClick={onShowAll}>
        Full play-by-play →
      </button>
    </section>
  );
}

/** ESPN's "On the court" box, for the Broncos: the top scorers with their key numbers. */
function TopPerformers({ box, onShowBox }: { box: BoxScore; onShowBox: () => void }) {
  const top = box.players
    .filter(({ line }) => Object.values(line).some((value) => value > 0))
    .sort((a, b) => b.line.pts - a.line.pts || b.line.reb - a.line.reb)
    .slice(0, 5);
  return (
    <section className="card gc-panel" aria-label="Top Broncos">
      <div className="gc-panel-head">
        <h2>Top Broncos</h2>
      </div>
      <table className="table gc-top">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col" title="Points">PTS</th>
            <th scope="col" title="Field goals made-attempted">FG</th>
            <th scope="col" title="Rebounds">REB</th>
            <th scope="col" title="Assists">AST</th>
            <th scope="col" title="Personal fouls">PF</th>
          </tr>
        </thead>
        <tbody>
          {top.map(({ player, line }) => (
            <tr key={player.athleteId}>
              <th scope="row">
                <Link href={`/players/${player.slug}`} className="player-cell" title={player.name}>
                  <span className="jersey">{player.number ?? ""}</span>
                  {shortName(player.name)}
                </Link>
              </th>
              <td>
                <FlashValue value={line.pts} />
              </td>
              <td>{fraction(line.fgm, line.fga)}</td>
              <td>
                <FlashValue value={line.reb} />
              </td>
              <td>
                <FlashValue value={line.ast} />
              </td>
              <td className={line.pf >= 4 ? "foul-trouble" : undefined}>{line.pf}</td>
            </tr>
          ))}
          {!top.length && (
            <tr>
              <td colSpan={6} className="muted">
                No stats yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button type="button" className="gc-more" onClick={onShowBox}>
        Full box score →
      </button>
    </section>
  );
}

function TeamStatsPanel({ game, box, events, line }: { game: GameSummary; box: BoxScore; events: GameEvent[]; line: LineScore }) {
  const t = box.team;
  const shooting: Array<[string, number, number]> = [
    ["Field goals", t.fgm, t.fga],
    ["3-pointers", t.fg3m, t.fg3a],
    ["Free throws", t.ftm, t.fta],
  ];
  const rows: Array<[string, string]> = [
    ["Rebounds", `${t.reb} (${t.oreb} off)`],
    ["Assists", String(t.ast)],
    ["Steals · Blocks", `${t.stl} · ${t.blk}`],
    ["Turnovers", String(t.tov)],
  ];
  // Only stats logged for both sides: the operator records opponent points, fouls and timeouts.
  const versus: Array<[string, number, number]> = [
    ...line.labels.flatMap((label, index): Array<[string, number, number]> =>
      line.team[index] === null ? [] : [[`${label} points`, line.team[index] ?? 0, line.opponent[index] ?? 0]],
    ),
    ["Fouls (game)", t.pf, box.opponent.pf],
    ["Timeouts used", timeoutsUsed(events, "team"), timeoutsUsed(events, "opponent")],
  ];
  return (
    <section className="card gc-panel" aria-label="Team stats">
      <div className="gc-panel-head">
        <h2>Broncos stats</h2>
      </div>
      <div className="gc-meters">
        {shooting.map(([label, made, attempted]) => (
          <div key={label} className="meter">
            <span className="meter-label">{label}</span>
            <FlashValue className="meter-value" value={`${made}-${attempted} · ${percentage(made, attempted)}`} />
            <span className="meter-track" aria-hidden="true">
              <span className="meter-fill" style={{ transform: `scaleX(${attempted ? made / attempted : 0})` }} />
            </span>
          </div>
        ))}
      </div>
      <dl className="gc-stats">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <FlashValue value={value} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="versus" role="table" aria-label={`Broncos and ${game.opponent.shortName} compared`}>
        <div className="versus-head" role="row">
          <span role="columnheader">Broncos</span>
          <span role="columnheader">
            <span className="visually-hidden">Stat</span>
          </span>
          <span role="columnheader">{game.opponent.shortName}</span>
        </div>
        {versus.map(([label, ours, theirs]) => {
          const most = Math.max(ours, theirs, 1);
          return (
            <div key={label} className="versus-row" role="row">
              <span className="versus-side" role="cell">
                <FlashValue className="versus-value" value={ours} />
                <span className="versus-track" aria-hidden="true">
                  <span className="versus-fill team" style={{ transform: `scaleX(${ours / most})` }} />
                </span>
              </span>
              <span className="versus-label" role="rowheader">
                {label}
              </span>
              <span className="versus-side opponent" role="cell">
                <span className="versus-track" aria-hidden="true">
                  <span className="versus-fill" style={{ transform: `scaleX(${theirs / most})` }} />
                </span>
                <FlashValue className="versus-value" value={theirs} />
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A value that holds yellow for a moment when it changes during the game. */
function FlashValue({ value, className = "" }: { value: string | number; className?: string }) {
  const changed = useFlashKey(value);
  return (
    <span key={changed} className={`${className} ${changed ? "flash" : ""}`}>
      {value}
    </span>
  );
}

// ---------------------------------------------------------------- Box score

type BoxColumn = { label: string; title: string; value: (line: StatLine) => string | number; leader?: (line: StatLine) => number };

const fraction = (made: number, attempted: number) => `${made}-${attempted}`;

// Points, rebounds and assists first: the numbers parents look for fit on a phone screen.
const BOX_COLUMNS: BoxColumn[] = [
  { label: "PTS", title: "Points", value: (line) => line.pts, leader: (line) => line.pts },
  { label: "REB", title: "Rebounds", value: (line) => line.reb, leader: (line) => line.reb },
  { label: "AST", title: "Assists", value: (line) => line.ast, leader: (line) => line.ast },
  { label: "FG", title: "Field goals made-attempted", value: (line) => fraction(line.fgm, line.fga), leader: (line) => line.fgm },
  { label: "3PT", title: "3-pointers made-attempted", value: (line) => fraction(line.fg3m, line.fg3a), leader: (line) => line.fg3m },
  { label: "FT", title: "Free throws made-attempted", value: (line) => fraction(line.ftm, line.fta), leader: (line) => line.ftm },
  { label: "STL", title: "Steals", value: (line) => line.stl, leader: (line) => line.stl },
  { label: "BLK", title: "Blocks", value: (line) => line.blk, leader: (line) => line.blk },
  { label: "TO", title: "Turnovers", value: (line) => line.tov },
  { label: "PF", title: "Personal fouls", value: (line) => line.pf },
];

function BoxScoreTable({ game, box }: { game: GameSummary; box: BoxScore }) {
  const played = box.players.filter(({ line }) => Object.values(line).some((value) => value > 0));
  const bench = box.players.filter((row) => !played.includes(row));
  const hasUnassigned = Object.values(box.unassigned).some((value) => value > 0);
  // The game high in each column is bold with a yellow rule under it.
  const highs = BOX_COLUMNS.map((column) => (column.leader ? Math.max(0, ...played.map(({ line }) => column.leader!(line))) : 0));
  const isHigh = (index: number, line: StatLine) => {
    const column = BOX_COLUMNS[index];
    return Boolean(column.leader) && highs[index] > 0 && column.leader!(line) === highs[index];
  };

  return (
    <section className="card" aria-label="Box score">
      <div className="card-head">
        <h2>Broncos</h2>
        <span className="muted small">
          {game.opponent.shortName}: {box.opponent.pts} pts · {box.opponent.pf} fouls
        </span>
      </div>
      <TableScroll>
        <table className="table box-score">
          <thead>
            <tr>
              <th>Player</th>
              {BOX_COLUMNS.map((column) => (
                <th key={column.label} title={column.title}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {played.map(({ player, line }) => (
              <tr key={player.athleteId}>
                <td>
                  <Link href={`/players/${player.slug}`} className="player-cell" title={player.name} aria-label={playerLabel(player)}>
                    <span className="jersey">{player.number ?? ""}</span>
                    <span className="name-full">{player.name}</span>
                    <span className="name-short">{shortName(player.name)}</span>
                  </Link>
                </td>
                {BOX_COLUMNS.map((column, index) => (
                  <td key={column.label} className={isHigh(index, line) ? "game-high" : undefined}>
                    <FlashValue value={column.value(line)} />
                  </td>
                ))}
              </tr>
            ))}
            {hasUnassigned && (
              <tr>
                <td className="muted">Team</td>
                {BOX_COLUMNS.map((column) => (
                  <td key={column.label}>{column.value(box.unassigned)}</td>
                ))}
              </tr>
            )}
            {!played.length && !hasUnassigned && (
              <tr>
                <td colSpan={BOX_COLUMNS.length + 1} className="muted">
                  No stats yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td>Totals</td>
              {BOX_COLUMNS.map((column) => (
                <td key={column.label}>
                  <FlashValue value={column.value(box.team)} />
                </td>
              ))}
            </tr>
            <tr>
              <td className="muted small">Shooting</td>
              <td colSpan={3} />
              <td className="muted small">{percentage(box.team.fgm, box.team.fga)}</td>
              <td className="muted small">{percentage(box.team.fg3m, box.team.fg3a)}</td>
              <td className="muted small">{percentage(box.team.ftm, box.team.fta)}</td>
              <td colSpan={4} />
            </tr>
            {/* The operator logs the opponent's points and fouls only. */}
            <tr className="box-opponent">
              <td>{game.opponent.shortName}</td>
              <td>
                <FlashValue value={box.opponent.pts} />
              </td>
              <td colSpan={8} />
              <td>
                <FlashValue value={box.opponent.pf} />
              </td>
            </tr>
          </tfoot>
        </table>
      </TableScroll>
      {bench.length > 0 && game.status !== "scheduled" && (
        <p className="muted small" style={{ padding: "12px 18px" }}>
          No stats recorded: {bench.map(({ player }) => playerLabel(player)).join(", ")}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Roster (pre-game)

function RosterList({ roster }: { roster: RosterPlayer[] }) {
  if (!roster.length) return <div className="card empty">The roster hasn&apos;t been posted yet.</div>;
  return (
    <section className="card" aria-label="Roster">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th>Height</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((player) => (
              <tr key={player.athleteId}>
                <td>
                  <Link href={`/players/${player.slug}`} className="player-cell">
                    <span className="jersey">{player.number ?? ""}</span>
                    {player.name}
                  </Link>
                </td>
                <td>{player.position ?? "–"}</td>
                <td>{player.height ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
