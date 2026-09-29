"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Court, CourtLegend } from "@/components/court";
import {
  EVENT_META,
  activeEvents,
  computeBoxScore,
  describeEvent,
  formatClock,
  gameLeaders,
  percentage,
  periodLabel,
  playerLabel,
  teamFouls,
  type BoxScore,
} from "@/lib/basketball";
import { formatDateTime, teamLabel } from "@/lib/format";
import type { LiveSnapshot } from "@/lib/live/service";
import { useLiveGame } from "@/lib/live/use-live-game";
import type { GameEvent, GameSummary, RosterPlayer } from "@/lib/types";

type Tab = "plays" | "box" | "shots" | "roster";

export function GameCenter({ initial }: { initial: LiveSnapshot }) {
  const live = useLiveGame(initial.game.id, initial);
  const game = live.game ?? initial.game;
  const roster = live.roster;
  const events = live.events;

  const box = useMemo(() => computeBoxScore(events, roster), [events, roster]);
  const started = game.status === "live" || game.status === "final" || activeEvents(events).length > 0;
  const [tab, setTab] = useState<Tab>(game.status === "final" ? "box" : started ? "plays" : "roster");

  const tabs: Array<{ id: Tab; label: string }> = started
    ? [
        { id: "plays", label: "Play-by-play" },
        { id: "box", label: "Box score" },
        { id: "shots", label: "Shot chart" },
      ]
    : [{ id: "roster", label: "Roster" }];

  return (
    <div className="stack">
      <Scoreboard game={game} events={events} clock={live.clock} status={live.status} />
      {started && <Leaders box={box} />}

      <div className="tabs" role="tablist">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "plays" && <PlayByPlay game={game} events={events} roster={roster} />}
      {tab === "box" && <BoxScoreTable game={game} box={box} />}
      {tab === "shots" && <ShotChart events={events} roster={roster} />}
      {tab === "roster" && <RosterList roster={roster} />}
    </div>
  );
}

// ---------------------------------------------------------------- Scoreboard

function Scoreboard({
  game,
  events,
  clock,
  status,
}: {
  game: GameSummary;
  events: GameEvent[];
  clock: number;
  status: string;
}) {
  const isLive = game.status === "live";
  const hasScore = isLive || game.status === "final";
  const teamFoulCount = teamFouls(game, events, "team");
  const opponentFoulCount = teamFouls(game, events, "opponent");

  let center: React.ReactNode;
  if (isLive) {
    center = (
      <>
        <span className="sb-period">{periodLabel(game.currentPeriod, game.periodCount)}</span>
        <span className={`sb-clock ${game.clockRunning ? "" : "stopped"}`}>{formatClock(clock)}</span>
        <span className="badge live">Live</span>
      </>
    );
  } else if (game.status === "final") {
    center = (
      <>
        <span className="badge final">Final</span>
        {game.currentPeriod > game.periodCount && <span className="sb-period">{periodLabel(game.currentPeriod, game.periodCount)}</span>}
      </>
    );
  } else {
    center = <span className="badge muted">{game.status === "scheduled" ? "Upcoming" : game.status}</span>;
  }

  const teamLeading = game.teamScore >= game.opponentScore;

  return (
    <section className="scoreboard" aria-label="Scoreboard">
      <div className="scoreboard-top">
        <span>
          {teamLabel(game.team)} · {formatDateTime(game.startsAt)}
        </span>
        <span>{isLive ? <span className={`connection ${status === "live" ? "live" : ""}`}>{status === "live" ? "Live updates" : "Reconnecting…"}</span> : game.location}</span>
      </div>
      <div className="scoreboard-body">
        <div className={`sb-team ${hasScore && !teamLeading ? "trailing" : ""}`}>
          <Image className="sb-mark" src="/brand/broncos-head-cropped.png" alt="" width={56} height={56} />
          <span className="sb-team-name">Broncos</span>
          <span className="sb-team-meta">{game.isHome ? "Home" : "Away"}</span>
          {hasScore && <span className="sb-score">{game.teamScore}</span>}
          {isLive && <Fouls count={teamFoulCount} bonus={opponentFoulCount >= game.bonusThreshold} />}
        </div>
        <div className="sb-center">{center}</div>
        <div className={`sb-team ${hasScore && teamLeading && game.teamScore !== game.opponentScore ? "trailing" : ""}`}>
          <span className="sb-mark opponent" aria-hidden="true">
            {game.opponent.shortName.slice(0, 1)}
          </span>
          <span className="sb-team-name">{game.opponent.shortName}</span>
          <span className="sb-team-meta">{game.isHome ? "Away" : "Home"}</span>
          {hasScore && <span className="sb-score">{game.opponentScore}</span>}
          {isLive && <Fouls count={opponentFoulCount} bonus={teamFoulCount >= game.bonusThreshold} />}
        </div>
      </div>
    </section>
  );
}

/** Team fouls this period; "Bonus" means this team shoots free throws on the other's fouls. */
function Fouls({ count, bonus }: { count: number; bonus: boolean }) {
  return (
    <span className="sb-fouls">
      Fouls {count}
      {bonus && <span className="bonus">Bonus</span>}
    </span>
  );
}

// ---------------------------------------------------------------- Leaders

function Leaders({ box }: { box: BoxScore }) {
  const leaders = gameLeaders(box);
  const rows = (
    [
      ["pts", "Points"],
      ["reb", "Rebounds"],
      ["ast", "Assists"],
    ] as const
  )
    .map(([key, label]) => ({ key, label, leader: leaders[key] }))
    .filter((row) => row.leader && row.leader.value > 0);
  if (!rows.length) return null;

  return (
    <section className="card" aria-label="Game leaders">
      <div className="card-head">
        <h2>Game leaders</h2>
      </div>
      <div className="grid-2" style={{ gap: 0 }}>
        {rows.map(({ key, label, leader }) => (
          <Link key={key} href={`/players/${leader!.player.slug}`} className="leader">
            <span className="jersey-badge">{leader!.player.number ?? "–"}</span>
            <span>
              <strong>{leader!.player.name}</strong>
              <br />
              <span className="muted small">{leader!.player.position ?? ""}</span>
            </span>
            <span className="leader-value">
              <strong>{leader!.value}</strong>
              <span>{label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Play-by-play

function PlayByPlay({ game, events, roster }: { game: GameSummary; events: GameEvent[]; roster: RosterPlayer[] }) {
  const players = useMemo(() => new Map(roster.map((player) => [player.athleteId, player])), [roster]);

  // Running score after each play, then newest first.
  const rows = useMemo(() => {
    let team = 0;
    let opponent = 0;
    const withScore = activeEvents(events).map((event) => {
      if (event.side === "team") team += event.points;
      if (event.side === "opponent") opponent += event.points;
      return { event, team, opponent };
    });
    return withScore.reverse();
  }, [events]);

  if (!rows.length) return <div className="card empty">No plays yet. They&apos;ll appear here as the game happens.</div>;

  const groups: Array<{ period: number; rows: typeof rows }> = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.period === row.event.period) last.rows.push(row);
    else groups.push({ period: row.event.period, rows: [row] });
  }

  return (
    <section className="card pbp" aria-label="Play-by-play">
      {groups.map((group) => (
        <div key={`${group.period}-${group.rows[0].event.id}`}>
          <div className="pbp-period">{periodLabel(group.period, game.periodCount)}</div>
          {group.rows.map(({ event, team, opponent }) => {
            const scoring = event.points > 0;
            return (
              <div key={event.id} className={`pbp-row ${event.side} ${scoring ? "scoring" : ""}`}>
                <span className="pbp-clock">{event.side === "game" ? "" : formatClock(event.clockSecondsLeft)}</span>
                <span>
                  {describeEvent(event, {
                    team: "Broncos",
                    opponent: game.opponent.shortName,
                    player: event.athleteId ? players.get(event.athleteId) : undefined,
                    periodCount: game.periodCount,
                  })}
                </span>
                <span className="pbp-score">{scoring ? `${team}–${opponent}` : ""}</span>
              </div>
            );
          })}
        </div>
      ))}
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

// ---------------------------------------------------------------- Shot chart

function ShotChart({ events, roster }: { events: GameEvent[]; roster: RosterPlayer[] }) {
  const [playerId, setPlayerId] = useState("all");
  const shots = activeEvents(events).filter(
    (event) =>
      event.side === "team" &&
      event.shotX !== null &&
      event.shotY !== null &&
      EVENT_META[event.type].isFieldGoal &&
      (playerId === "all" || event.athleteId === playerId),
  );
  const shooters = roster.filter((player) =>
    events.some((event) => event.athleteId === player.athleteId && event.shotX !== null && !event.voidedAt),
  );
  const made = shots.filter((shot) => EVENT_META[shot.type].made).length;

  return (
    <section className="card card-pad stack" aria-label="Shot chart">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <label className="field" style={{ minWidth: 220 }}>
          <span className="visually-hidden">Player</span>
          <select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
            <option value="all">All Broncos</option>
            {shooters.map((player) => (
              <option key={player.athleteId} value={player.athleteId}>
                {playerLabel(player)}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small tabular">
          {made}/{shots.length} FG · {percentage(made, shots.length)}
        </span>
      </div>
      <div style={{ maxWidth: 560, width: "100%", margin: "0 auto" }}>
        <Court
          shots={shots.map((shot) => ({
            id: shot.id,
            x: shot.shotX!,
            y: shot.shotY!,
            made: EVENT_META[shot.type].made,
            label: `${EVENT_META[shot.type].label} · ${periodLabel(shot.period)} ${formatClock(shot.clockSecondsLeft)}`,
          }))}
        />
      </div>
      <CourtLegend />
      {!shots.length && <p className="muted small">Shot locations appear when the operator marks them on the court.</p>}
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
