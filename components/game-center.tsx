"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Countdown } from "@/components/countdown";
import { Court, CourtLegend } from "@/components/court";
import { GameFlowChart } from "@/components/stats/game-flow";
import { LeaderBars } from "@/components/stats/leader-bars";
import { ZoneChart, ZoneLegend } from "@/components/stats/zone-chart";
import {
  EVENT_META,
  activeEvents,
  computeBoxScore,
  describeEvent,
  formatClock,
  percentage,
  periodLabel,
  playerLabel,
  teamFouls,
  timeoutsUsed,
  type BoxScore,
} from "@/lib/basketball";
import { formatDateTime, teamLabel } from "@/lib/format";
import { elapsedSeconds, gameFlow, lineScore, zoneStats, type LineScore } from "@/lib/game-analysis";
import type { LiveSnapshot } from "@/lib/live/service";
import { useLiveGame } from "@/lib/live/use-live-game";
import type { GameEvent, GameSummary, RosterPlayer } from "@/lib/types";
import { useFlashKey } from "@/lib/use-flash";

/**
 * The game page, laid out like a TV "gamecast": a compact scoreboard with the
 * line score, then the court, the play-by-play feed and the leaders side by
 * side, so a live game fits on one screen. Box score and game flow sit below.
 */
export function GameCenter({ initial }: { initial: LiveSnapshot }) {
  const live = useLiveGame(initial.game.id, initial);
  const game = live.game ?? initial.game;
  const roster = live.roster;
  const events = live.events;

  const box = useMemo(() => computeBoxScore(events, roster), [events, roster]);
  const line = useMemo(() => lineScore(game, events), [game, events]);
  const started = game.status === "live" || game.status === "final" || activeEvents(events).length > 0;
  const [tab, setTab] = useState<"box" | "flow">("box");

  if (!started) {
    return (
      <div className="stack">
        <Scoreboard game={game} events={events} clock={live.clock} status={live.status} line={null} />
        <section>
          <div className="section-head">
            <h2>Roster</h2>
          </div>
          <RosterList roster={roster} />
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <Scoreboard game={game} events={events} clock={live.clock} status={live.status} line={line} />

      <div className="gc-grid">
        <ShotPanel game={game} events={events} roster={roster} />
        <PlaysPanel game={game} events={events} roster={roster} />
        <aside className="gc-side">
          <LeadersPanel box={box} />
          <TeamStatsPanel game={game} box={box} events={events} />
        </aside>
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "box"} onClick={() => setTab("box")}>
          Box score
        </button>
        <button type="button" role="tab" aria-selected={tab === "flow"} onClick={() => setTab("flow")}>
          Game flow
        </button>
      </div>
      {tab === "box" ? (
        <BoxScoreTable game={game} box={box} />
      ) : (
        <section className="card card-pad" aria-label="Game flow">
          <GameFlowChart
            flow={gameFlow(game, events)}
            game={game}
            opponentName={game.opponent.shortName}
            nowT={game.status === "live" ? elapsedSeconds(game, game.currentPeriod, live.clock) : undefined}
          />
        </section>
      )}
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
  status: string;
  line: LineScore | null;
}) {
  const isLive = game.status === "live";
  const hasScore = isLive || game.status === "final";
  const teamFlash = useFlashKey(game.teamScore);
  const opponentFlash = useFlashKey(game.opponentScore);
  const teamFoulCount = teamFouls(game, events, "team");
  const opponentFoulCount = teamFouls(game, events, "opponent");

  const team = {
    name: "Broncos",
    score: game.teamScore,
    flash: teamFlash,
    side: game.isHome ? "Home" : "Away",
    fouls: teamFoulCount,
    timeouts: timeoutsUsed(events, "team"),
    bonus: opponentFoulCount >= game.bonusThreshold,
    trailing: hasScore && game.teamScore < game.opponentScore,
  };
  const opponent = {
    name: game.opponent.shortName,
    score: game.opponentScore,
    flash: opponentFlash,
    side: game.isHome ? "Away" : "Home",
    fouls: opponentFoulCount,
    timeouts: timeoutsUsed(events, "opponent"),
    bonus: teamFoulCount >= game.bonusThreshold,
    trailing: hasScore && game.opponentScore < game.teamScore,
  };

  return (
    <section className="gc-board" aria-label="Scoreboard">
      <div className="gc-board-meta">
        <span>
          {teamLabel(game.team)} · {formatDateTime(game.startsAt)}
          {game.location ? ` · ${game.location}` : ""}
        </span>
        {isLive && <span className={`connection ${status === "live" ? "live" : ""}`}>{status === "live" ? "Live updates" : "Reconnecting…"}</span>}
      </div>

      <div className="gc-board-body">
        <div className="gc-matchup">
          <TeamScore team={team} mark={<Image className="gc-mark" src="/brand/broncos-head-cropped.png" alt="" width={56} height={56} priority />} hasScore={hasScore} showFouls={isLive} />

          <div className="gc-status">
            {isLive ? (
              <>
                <span className="badge live">Live</span>
                <span className="gc-period">{periodLabel(game.currentPeriod, game.periodCount)}</span>
                <span className={`gc-clock ${game.clockRunning ? "" : "stopped"}`} suppressHydrationWarning>
                  {formatClock(clock)}
                </span>
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
                  {line.labels.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                  <th>T</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Broncos", line.team],
                  [game.opponent.shortName, line.opponent],
                ].map(([name, values]) => (
                  <tr key={name as string}>
                    <th scope="row">{name as string}</th>
                    {(values as number[]).map((value, index) => (
                      <td key={line.labels[index]}>{value}</td>
                    ))}
                    <td className="total">{(values as number[]).reduce((sum, value) => sum + value, 0)}</td>
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
  flash: number;
  side: string;
  fouls: number;
  timeouts: number;
  bonus: boolean;
  trailing: boolean;
};

function TeamScore({
  team,
  mark,
  hasScore,
  showFouls,
  reverse = false,
}: {
  team: TeamSide;
  mark: React.ReactNode;
  hasScore: boolean;
  showFouls: boolean;
  reverse?: boolean;
}) {
  return (
    <div className={`gc-team ${reverse ? "reverse" : ""} ${team.trailing ? "trailing" : ""}`}>
      {mark}
      <span className="gc-team-text">
        <strong>{team.name}</strong>
        <span>
          {team.side}
          {showFouls && ` · Fouls ${team.fouls} · TO ${team.timeouts}`}
          {showFouls && team.bonus && <span className="bonus">Bonus</span>}
        </span>
      </span>
      {hasScore && (
        <span key={team.flash} className={`gc-score ${team.flash ? "flash" : ""}`}>
          {team.score}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Shot chart panel

function ShotPanel({ game, events, roster }: { game: GameSummary; events: GameEvent[]; roster: RosterPlayer[] }) {
  const [playerId, setPlayerId] = useState("all");
  const [view, setView] = useState<"shots" | "zones">("shots");
  const players = useMemo(() => new Map(roster.map((player) => [player.athleteId, player])), [roster]);

  const active = activeEvents(events);
  const shots = active.filter(
    (event) =>
      event.side === "team" &&
      event.shotX !== null &&
      event.shotY !== null &&
      EVENT_META[event.type].isFieldGoal &&
      (playerId === "all" || event.athleteId === playerId),
  );
  const shooters = roster.filter((player) => active.some((event) => event.athleteId === player.athleteId && event.shotX !== null));
  const made = shots.filter((shot) => EVENT_META[shot.type].made).length;
  const lastPlay = [...active].reverse().find((event) => event.side !== "game");
  const latestShotId = shots[shots.length - 1]?.id;

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
          {made}/{shots.length} · {percentage(made, shots.length)}
        </span>
      </div>
      <div className="gc-controls">
        <div className="tabs small" role="tablist">
          {(["shots", "zones"] as const).map((option) => (
            <button key={option} type="button" role="tab" aria-selected={view === option} onClick={() => setView(option)}>
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
      <div className="gc-court">
        {view === "shots" ? (
          <Court
            shots={shots.map((shot) => ({
              id: shot.id,
              x: shot.shotX!,
              y: shot.shotY!,
              made: EVENT_META[shot.type].made,
              latest: shot.id === latestShotId,
              label: `${EVENT_META[shot.type].label} · ${periodLabel(shot.period)} ${formatClock(shot.clockSecondsLeft)}`,
            }))}
          />
        ) : (
          <ZoneChart stats={zoneStats(events, playerId === "all" ? undefined : playerId)} />
        )}
      </div>
      <div className="gc-panel-foot">{view === "shots" ? <CourtLegend /> : <ZoneLegend />}</div>
    </section>
  );
}

// ---------------------------------------------------------------- Play-by-play panel

function PlaysPanel({ game, events, roster }: { game: GameSummary; events: GameEvent[]; roster: RosterPlayer[] }) {
  const players = useMemo(() => new Map(roster.map((player) => [player.athleteId, player])), [roster]);
  const [period, setPeriod] = useState<number | "all">("all");
  // Plays present when the page loaded don't animate; anything after does.
  const seen = useRef<Set<string> | null>(null);
  seen.current ??= new Set(events.map((event) => event.id));

  // Running score after each play, newest first.
  const rows = useMemo(() => {
    let team = 0;
    let opponent = 0;
    return activeEvents(events)
      .map((event) => {
        if (event.side === "team") team += event.points;
        if (event.side === "opponent") opponent += event.points;
        return { event, team, opponent };
      })
      .reverse();
  }, [events]);

  const periods = [...new Set(rows.map((row) => row.event.period))].sort((a, b) => a - b);
  const shown = period === "all" ? rows : rows.filter((row) => row.event.period === period);

  return (
    <section className="card gc-panel gc-plays" aria-label="Play-by-play">
      <div className="gc-panel-head">
        <h2>Play-by-play</h2>
      </div>
      <div className="gc-period-filter" role="tablist" aria-label="Quarter">
        {(["all", ...periods] as const).map((option) => (
          <button key={option} type="button" role="tab" aria-selected={period === option} onClick={() => setPeriod(option)}>
            {option === "all" ? "All" : periodLabel(option, game.periodCount)}
          </button>
        ))}
      </div>
      <ol className="gc-feed">
        {shown.map(({ event, team, opponent }) => {
          const scoring = event.points > 0;
          if (event.side === "game") {
            return (
              <li key={event.id} className="gc-feed-marker">
                {describeEvent(event, { team: "Broncos", opponent: game.opponent.shortName, periodCount: game.periodCount })}
              </li>
            );
          }
          return (
            <li key={event.id} className={`gc-feed-row ${event.side} ${scoring ? "scoring" : ""} ${seen.current!.has(event.id) ? "" : "pbp-new"}`}>
              <span className="gc-feed-time">
                {period === "all" && <b>{periodLabel(event.period, game.periodCount)}</b>} {formatClock(event.clockSecondsLeft)}
              </span>
              <span className="gc-feed-text">
                {describeEvent(event, {
                  team: "Broncos",
                  opponent: game.opponent.shortName,
                  player: event.athleteId ? players.get(event.athleteId) : undefined,
                  periodCount: game.periodCount,
                })}
              </span>
              <span className="gc-feed-score">{scoring ? `${team}–${opponent}` : ""}</span>
            </li>
          );
        })}
        {!shown.length && <li className="gc-feed-empty">No plays yet.</li>}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- Side column

function LeadersPanel({ box }: { box: BoxScore }) {
  const top = (key: "pts" | "reb" | "ast") =>
    [...box.players]
      .sort((a, b) => b.line[key] - a.line[key])
      .slice(0, 3)
      .map(({ player, line }) => ({ player, value: line[key] }));
  return (
    <section className="card gc-panel gc-leaders" aria-label="Game leaders">
      <div className="gc-panel-head">
        <h2>Leaders</h2>
      </div>
      <div className="gc-leaders-list">
        <LeaderBars title="Points" rows={top("pts")} unit="PTS" />
        <LeaderBars title="Rebounds" rows={top("reb")} unit="REB" />
        <LeaderBars title="Assists" rows={top("ast")} unit="AST" />
      </div>
    </section>
  );
}

function TeamStatsPanel({ game, box, events }: { game: GameSummary; box: BoxScore; events: GameEvent[] }) {
  const t = box.team;
  const rows: Array<[string, string]> = [
    ["Field goals", `${t.fgm}-${t.fga} · ${percentage(t.fgm, t.fga)}`],
    ["3-pointers", `${t.fg3m}-${t.fg3a} · ${percentage(t.fg3m, t.fg3a)}`],
    ["Free throws", `${t.ftm}-${t.fta} · ${percentage(t.ftm, t.fta)}`],
    ["Rebounds", `${t.reb} (${t.oreb} off)`],
    ["Assists", String(t.ast)],
    ["Steals · Blocks", `${t.stl} · ${t.blk}`],
    ["Turnovers", String(t.tov)],
  ];
  return (
    <section className="card gc-panel" aria-label="Team stats">
      <div className="gc-panel-head">
        <h2>Broncos stats</h2>
      </div>
      <dl className="gc-stats">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>Fouls (game)</dt>
          <dd>
            {t.pf} – {box.opponent.pf} {game.opponent.shortName}
          </dd>
        </div>
        <div>
          <dt>Timeouts used</dt>
          <dd>
            {timeoutsUsed(events, "team")} – {timeoutsUsed(events, "opponent")} {game.opponent.shortName}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- Box score

function BoxScoreTable({ game, box }: { game: GameSummary; box: BoxScore }) {
  const played = box.players.filter(({ line }) => Object.values(line).some((value) => value > 0));
  const bench = box.players.filter((row) => !played.includes(row));
  const fraction = (made: number, attempted: number) => `${made}-${attempted}`;
  const hasUnassigned = Object.values(box.unassigned).some((value) => value > 0);

  return (
    <section className="card" aria-label="Box score">
      <div className="card-head">
        <h2>Broncos</h2>
        <span className="muted small">
          {game.opponent.shortName}: {box.opponent.pts} pts · {box.opponent.pf} fouls
        </span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>PTS</th>
              <th>FG</th>
              <th>3PT</th>
              <th>FT</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TO</th>
              <th>PF</th>
            </tr>
          </thead>
          <tbody>
            {played.map(({ player, line }) => (
              <tr key={player.athleteId}>
                <td>
                  <Link href={`/players/${player.slug}`} className="player-cell">
                    <span className="jersey">{player.number ?? ""}</span>
                    {player.name}
                  </Link>
                </td>
                <td>
                  <strong>{line.pts}</strong>
                </td>
                <td>{fraction(line.fgm, line.fga)}</td>
                <td>{fraction(line.fg3m, line.fg3a)}</td>
                <td>{fraction(line.ftm, line.fta)}</td>
                <td>{line.reb}</td>
                <td>{line.ast}</td>
                <td>{line.stl}</td>
                <td>{line.blk}</td>
                <td>{line.tov}</td>
                <td>{line.pf}</td>
              </tr>
            ))}
            {hasUnassigned && (
              <tr>
                <td className="muted">Team</td>
                <td>{box.unassigned.pts}</td>
                <td>{fraction(box.unassigned.fgm, box.unassigned.fga)}</td>
                <td>{fraction(box.unassigned.fg3m, box.unassigned.fg3a)}</td>
                <td>{fraction(box.unassigned.ftm, box.unassigned.fta)}</td>
                <td>{box.unassigned.reb}</td>
                <td>{box.unassigned.ast}</td>
                <td>{box.unassigned.stl}</td>
                <td>{box.unassigned.blk}</td>
                <td>{box.unassigned.tov}</td>
                <td>{box.unassigned.pf}</td>
              </tr>
            )}
            {!played.length && !hasUnassigned && (
              <tr>
                <td colSpan={11} className="muted">
                  No stats yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td>Totals</td>
              <td>{box.team.pts}</td>
              <td>{fraction(box.team.fgm, box.team.fga)}</td>
              <td>{fraction(box.team.fg3m, box.team.fg3a)}</td>
              <td>{fraction(box.team.ftm, box.team.fta)}</td>
              <td>{box.team.reb}</td>
              <td>{box.team.ast}</td>
              <td>{box.team.stl}</td>
              <td>{box.team.blk}</td>
              <td>{box.team.tov}</td>
              <td>{box.team.pf}</td>
            </tr>
            <tr>
              <td className="muted small">Shooting</td>
              <td />
              <td className="muted small">{percentage(box.team.fgm, box.team.fga)}</td>
              <td className="muted small">{percentage(box.team.fg3m, box.team.fg3a)}</td>
              <td className="muted small">{percentage(box.team.ftm, box.team.fta)}</td>
              <td colSpan={6} />
            </tr>
          </tfoot>
        </table>
      </div>
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
