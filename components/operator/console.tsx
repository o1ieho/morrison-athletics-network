"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Pause, Play, RotateCcw, Undo2 } from "lucide-react";
import { Court } from "@/components/court";
import {
  EVENT_META,
  activeEvents,
  computeBoxScore,
  describeEvent,
  formatClock,
  parseClock,
  periodLabel,
  pointsFor,
  teamFouls,
  timeoutsUsed,
} from "@/lib/basketball";
import { isDemoMode } from "@/lib/config";
import { COURT, isThreePointSpot } from "@/lib/court";
import { teamLabel } from "@/lib/format";
import { resetDemo } from "@/lib/live/local";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { LiveSnapshot, NewEvent } from "@/lib/live/service";
import { useEventQueue } from "@/lib/live/use-event-queue";
import { useLiveGame } from "@/lib/live/use-live-game";
import type { EventType, Game, GameEvent, RosterPlayer, Side } from "@/lib/types";

/** A player's athlete id, or "team" for team rebounds / turnovers. */
type Target = string;
type Spot = { x: number; y: number };
/** A suggested next stat, stamped with the shot's period and clock so it lines up in the play-by-play. */
type FollowUp = { kind: "assist" | "rebound"; shooterId: string | null; period: number; clockSecondsLeft: number } | null;

const FOULED_OUT = 5;

const SHOT_BUTTONS: Array<{ type: EventType; label: string; tone: "make" | "miss" }> = [
  { type: "fg2_made", label: "2PT Make", tone: "make" },
  { type: "fg2_miss", label: "2PT Miss", tone: "miss" },
  { type: "fg3_made", label: "3PT Make", tone: "make" },
  { type: "fg3_miss", label: "3PT Miss", tone: "miss" },
  { type: "ft_made", label: "FT Make", tone: "make" },
  { type: "ft_miss", label: "FT Miss", tone: "miss" },
];

const STAT_BUTTONS: Array<{ type: EventType; label: string; tone?: "bad" }> = [
  { type: "rebound_off", label: "Off Reb" },
  { type: "rebound_def", label: "Def Reb" },
  { type: "assist", label: "Assist" },
  { type: "steal", label: "Steal" },
  { type: "block", label: "Block" },
  { type: "turnover", label: "Turnover", tone: "bad" },
  { type: "foul", label: "Foul", tone: "bad" },
];

type LogRow = { event: GameEvent; pending?: "sending" | "waiting" | "failed"; error?: string };

/** A plausible shot location for auto-play: a 3 beyond the arc, or a 2 inside it. */
function randomSpot(three: boolean): Spot {
  for (;;) {
    const angle = Math.random() * Math.PI;
    const radius = three ? 6.9 + Math.random() * 1.1 : 0.4 + Math.random() * 5.4;
    const x = COURT.basket.x + Math.cos(angle) * radius;
    const y = COURT.basket.y + Math.sin(angle) * radius;
    if (x > 0.3 && x < COURT.width - 0.3 && y > 0.2 && y < COURT.depth - 0.5) {
      const spot = { x: Number((x / COURT.width).toFixed(4)), y: Number((y / COURT.depth).toFixed(4)) };
      if (isThreePointSpot(spot.x, spot.y) === three) return spot;
    }
  }
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function OperatorConsole({ initial }: { initial: LiveSnapshot }) {
  const live = useLiveGame(initial.game.id, initial);
  const game = live.game ?? initial.game;
  const roster = live.roster;
  const queue = useEventQueue(live.service, game.id, live.applyEvent);

  const [selected, setSelected] = useState<Target | null>(null);
  const [pendingAction, setPendingAction] = useState<EventType | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [followUp, setFollowUp] = useState<FollowUp>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [editingClock, setEditingClock] = useState(false);
  const [clockDraft, setClockDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const players = useMemo(() => new Map(roster.map((player) => [player.athleteId, player])), [roster]);

  // Confirmed events plus plays still waiting to send, oldest first.
  const rows: LogRow[] = useMemo(() => {
    const confirmedIds = new Set(live.events.map((event) => event.id));
    // A removed play that already reached the server is still being undone
    // there. Show it as undone now so it never counts toward the score.
    const removing = new Map(queue.items.filter((item) => item.cancel).map((item) => [item.input.id, item.queuedAt]));
    const confirmed: LogRow[] = live.events.map((event) => {
      const removedAt = removing.get(event.id);
      return { event: removedAt && !event.voidedAt ? { ...event, voidedAt: removedAt } : event };
    });
    const pending: LogRow[] = queue.items
      .filter((item) => !item.cancel && !confirmedIds.has(item.input.id))
      .map((item) => ({
        event: {
          ...item.input,
          gameId: game.id,
          points: pointsFor(item.input.type),
          createdAt: item.queuedAt,
          voidedAt: null,
        },
        pending: item.state,
        error: item.error,
      }));
    return [...confirmed, ...pending];
  }, [game.id, live.events, queue.items]);

  const allEvents = useMemo(() => rows.map((row) => row.event), [rows]);
  const box = useMemo(() => computeBoxScore(allEvents, roster), [allEvents, roster]);
  const lines = useMemo(() => new Map(box.players.map((row) => [row.player.athleteId, row.line])), [box]);

  // In live mode the score is added up from the plays on this screen (saved
  // and still sending), the same way the server does it. Reading the saved
  // score instead could show a stale number when live updates are blocked.
  const teamScore = game.scoringMode === "live" ? box.team.pts : game.teamScore;
  const opponentScore = game.scoringMode === "live" ? box.opponent.pts : game.opponentScore;

  const periodEnded = activeEvents(allEvents).some((event) => event.type === "period_end" && event.period === game.currentPeriod);
  const periodStarted = activeEvents(allEvents).some((event) => event.type === "period_start" && event.period === game.currentPeriod);

  const flash = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast((current) => (current?.text === text ? null : current)), error ? 6000 : 2200);
  }, []);

  // ------------------------------------------------------------ Logging

  const log = useCallback(
    (side: Side, type: EventType, athleteId: string | null, shot: Spot | null = null, stamp?: { period: number; clockSecondsLeft: number }) => {
      const isFieldGoal = EVENT_META[type].isFieldGoal;
      const event: NewEvent = {
        id: crypto.randomUUID(),
        side,
        type,
        athleteId,
        period: stamp?.period ?? game.currentPeriod,
        clockSecondsLeft: stamp?.clockSecondsLeft ?? live.clock,
        shotX: isFieldGoal && shot ? shot.x : null,
        shotY: isFieldGoal && shot ? shot.y : null,
      };
      queue.enqueue(event);

      const who = athleteId ? players.get(athleteId) : undefined;
      flash(describeEvent(event, { team: "Broncos", opponent: game.opponent.shortName, player: who }));

      // Offer the natural next stat for MAT shots.
      const shotStamp = { period: event.period, clockSecondsLeft: event.clockSecondsLeft };
      if (side === "team" && isFieldGoal) {
        setFollowUp({ kind: EVENT_META[type].made ? "assist" : "rebound", shooterId: athleteId, ...shotStamp });
      } else if (side === "team" && type === "ft_miss") {
        setFollowUp({ kind: "rebound", shooterId: athleteId, ...shotStamp });
      } else {
        setFollowUp(null);
      }
    },
    [flash, game.currentPeriod, game.opponent.shortName, live.clock, players, queue],
  );

  const logForTeam = useCallback(
    (type: EventType, pick: Target) => {
      log("team", type, pick === "team" ? null : pick, spot);
      setSelected(null);
      setPendingAction(null);
      setSpot(null);
    },
    [log, spot],
  );

  function onAction(type: EventType) {
    if (selected) {
      logForTeam(type, selected);
    } else {
      // Action first: wait for the player.
      setPendingAction((current) => (current === type ? null : type));
      setFollowUp(null);
    }
  }

  function onPlayer(pick: Target) {
    if (pendingAction) {
      logForTeam(pendingAction, pick);
    } else {
      setSelected((current) => (current === pick ? null : pick));
    }
  }

  function onCourt(event: React.MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    setSpot({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
  }

  function onSpotResult(made: boolean) {
    if (!spot) return;
    const three = isThreePointSpot(spot.x, spot.y);
    const type: EventType = three ? (made ? "fg3_made" : "fg3_miss") : made ? "fg2_made" : "fg2_miss";
    onAction(type);
  }

  function onFollowUp(pick: Target | null) {
    if (followUp && pick) {
      log("team", followUp.kind === "assist" ? "assist" : "rebound_off", pick === "team" ? null : pick, null, followUp);
    }
    setFollowUp(null);
  }

  // ------------------------------------------------------------ Undo

  const undoable = [...rows].reverse().find((row) => !row.event.voidedAt && row.event.side !== "game");

  async function toggleVoid(row: LogRow) {
    if (row.pending) {
      queue.cancel(row.event.id);
      flash("Removed unsent play");
      return;
    }
    try {
      const updated = await live.service.setVoided(row.event.id, !row.event.voidedAt);
      live.applyEvent(updated);
      flash(updated.voidedAt ? `Undone: ${describeRow(row)}` : `Restored: ${describeRow(row)}`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not update the play", true);
    }
  }

  function describeRow(row: LogRow) {
    return describeEvent(row.event, {
      team: "Broncos",
      opponent: game.opponent.shortName,
      player: row.event.athleteId ? players.get(row.event.athleteId) : undefined,
      periodCount: game.periodCount,
    });
  }

  // ------------------------------------------------------------ Clock & periods

  async function run(action: () => Promise<Game>, done?: string) {
    setBusy(true);
    try {
      live.applyGame(await action());
      if (done) flash(done);
    } catch (error) {
      flash(error instanceof Error ? error.message : "That didn't work. Try again.", true);
    } finally {
      setBusy(false);
      void live.reload();
    }
  }

  function toggleClock() {
    if (game.status !== "live" && !periodStarted) return;
    void run(() => (game.clockRunning ? live.service.clockStop(game.id) : live.service.clockStart(game.id)));
  }

  function saveClock() {
    const seconds = parseClock(clockDraft);
    if (seconds === null) {
      flash("Enter the clock like 7:30", true);
      return;
    }
    setEditingClock(false);
    void run(() => live.service.clockSet(game.id, seconds), `Clock set to ${formatClock(seconds)}`);
  }

  const nextPeriod = game.currentPeriod + 1;
  const tied = teamScore === opponentScore;
  const regulationOver = game.currentPeriod >= game.periodCount;

  function finishGame() {
    const message = tied
      ? `The score is tied ${teamScore}–${opponentScore}. Finish the game anyway?`
      : `Finish the game? Final score: Broncos ${teamScore}, ${game.opponent.shortName} ${opponentScore}.`;
    if (window.confirm(message)) void run(() => live.service.setStatus(game.id, "final"), "Game marked final");
  }

  // ------------------------------------------------------------ Auto-play (demo games only)

  const canAutoPlay = game.id.startsWith("demo-");
  const [autoPlay, setAutoPlay] = useState(false);
  const autoTick = useRef<() => void>(() => {});

  autoTick.current = () => {
    if (busy || game.status === "final") return;
    if (!periodStarted && game.status !== "live") {
      void run(() => live.service.startPeriod(game.id, Math.max(1, game.currentPeriod)));
      return;
    }
    if (periodEnded) {
      if (game.currentPeriod < game.periodCount) void run(() => live.service.startPeriod(game.id, game.currentPeriod + 1));
      else setAutoPlay(false);
      return;
    }
    if (live.clock <= 0) {
      void run(() => live.service.endPeriod(game.id));
      return;
    }
    if (!game.clockRunning) {
      void run(() => live.service.clockStart(game.id));
      return;
    }

    const players = roster.filter((player) => (lines.get(player.athleteId)?.pf ?? 0) < FOULED_OUT);
    if (!players.length) return;
    const roll = Math.random();
    if (roll < 0.42) {
      const shooter = pick(players);
      const three = Math.random() < 0.35;
      const made = Math.random() < (three ? 0.36 : 0.5);
      const stamp = { period: game.currentPeriod, clockSecondsLeft: live.clock };
      log("team", three ? (made ? "fg3_made" : "fg3_miss") : made ? "fg2_made" : "fg2_miss", shooter.athleteId, randomSpot(three), stamp);
      const teammates = players.filter((player) => player.athleteId !== shooter.athleteId);
      if (made && teammates.length && Math.random() < 0.55) log("team", "assist", pick(teammates).athleteId, null, stamp);
      if (!made && Math.random() < 0.3) log("team", "rebound_off", pick(players).athleteId, null, stamp);
      setFollowUp(null);
    } else if (roll < 0.72) {
      const kind = Math.random();
      if (kind < 0.62) log("opponent", "fg2_made", null);
      else if (kind < 0.85) log("opponent", "fg3_made", null);
      else {
        log("team", "foul", pick(players).athleteId);
        log("opponent", "ft_made", null);
        if (Math.random() < 0.7) log("opponent", "ft_made", null);
      }
    } else if (roll < 0.86) {
      log("team", pick<EventType>(["rebound_def", "rebound_def", "steal", "block"]), pick(players).athleteId);
    } else if (roll < 0.94) {
      log("opponent", "foul", null);
      const shooter = pick(players).athleteId;
      log("team", Math.random() < 0.7 ? "ft_made" : "ft_miss", shooter);
      log("team", Math.random() < 0.7 ? "ft_made" : "ft_miss", shooter);
    } else {
      log("team", "turnover", pick(players).athleteId);
    }
  };

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => autoTick.current(), 3000);
    return () => window.clearInterval(timer);
  }, [autoPlay]);

  // ------------------------------------------------------------ Keyboard

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Don't hijack keys while typing in a field (e.g. correcting the clock).
      const target = event.target;
      if (target instanceof Element && target.closest("input, select, textarea")) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggleClock();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (undoable) void toggleVoid(undoable);
      } else if (event.key === "Escape") {
        setSelected(null);
        setPendingAction(null);
        setSpot(null);
        setFollowUp(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------ Connection, sign-in and screen

  // Offline: the page itself can't be loaded again without Wi-Fi, so the
  // operator is told to stay put. Plays keep saving to this device.
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Signed out mid-game (the session ended or was signed out elsewhere):
  // saves are refused until the operator signs in again. Queued plays stay
  // on this device and send after sign-in.
  const refused = queue.items.some((item) => item.authError);
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    if (isDemoMode) return;
    const auth = getBrowserClient().auth;
    const check = () => void auth.getSession().then(({ data }) => setSignedOut(!data.session));
    if (refused) check();
    const { data } = auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setSignedOut(true);
      else if (session) setSignedOut(false);
    });
    return () => data.subscription.unsubscribe();
  }, [refused]);

  // Keep the iPad screen on during a game. A locked screen pauses saving.
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (!wakeLock) return;
    let lock: { release(): Promise<void> } | null = null;
    let stopped = false;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      wakeLock
        .request("screen")
        .then((next) => {
          if (stopped) void next.release();
          else lock = next;
        })
        .catch(() => {
          // Not allowed (e.g. Low Power Mode): the Auto-Lock setting still applies.
        });
    };
    acquire();
    // The lock is dropped whenever the page is hidden, so take it again on return.
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, []);

  function leaveGuard(event: React.MouseEvent) {
    if (!unsent && !offline) return;
    const message = unsent
      ? `${unsent} ${unsent === 1 ? "play hasn't" : "plays haven't"} been saved yet. They only send while this game is open. Leave anyway?`
      : "You're offline, so this page won't load again until Wi-Fi is back. Leave anyway?";
    if (!window.confirm(message)) event.preventDefault();
  }

  // ------------------------------------------------------------ Render

  if (!live.game && live.loaded) {
    return <div className="op-message">This game no longer exists.</div>;
  }

  const teamFoulCount = teamFouls(game, allEvents, "team");
  const opponentFoulCount = teamFouls(game, allEvents, "opponent");
  const unsent = queue.items.filter((item) => !item.cancel).length;
  const failed = queue.items.filter((item) => item.state === "failed" && !item.cancel).length;
  // Plays still on their way. Quarter buttons wait for these so the
  // play-by-play stays in order.
  const inFlight = queue.items.filter((item) => item.state !== "failed").length;
  const periodBusy = busy || inFlight > 0;
  const periodWait = inFlight > 0 ? "Waiting for plays to finish saving" : undefined;
  const threeSpot = spot ? isThreePointSpot(spot.x, spot.y) : false;
  const prompt = pendingAction
    ? `Who? ${EVENT_META[pendingAction].label}`
    : selected
      ? `${selected === "team" ? "Team" : playerName(players.get(selected))}: choose a stat`
      : "Tap a player, then a stat (or a stat, then a player)";

  return (
    <div className="op">
      <header className="op-top">
        <Link href="/operator" className="op-back" onClick={leaveGuard}>
          <ChevronLeft size={18} /> Games
        </Link>
        <div className="op-title">
          <strong>
            Broncos {game.isHome ? "vs" : "at"} {game.opponent.shortName}
          </strong>
          <span>{teamLabel(game.team)}</span>
        </div>
        <div className="op-status">
          {isDemoMode && <span className="op-pill warn">Demo</span>}
          {failed > 0 ? (
            <button type="button" className="op-pill error" onClick={queue.retryFailed}>
              {failed} failed · retry
            </button>
          ) : unsent > 0 ? (
            <span className="op-pill warn">{unsent} sending…</span>
          ) : (
            <span className="op-pill ok">All saved</span>
          )}
          <span className={`connection ${live.status === "live" ? "live" : ""}`}>{live.status === "live" ? "Connected" : "Reconnecting"}</span>
        </div>
      </header>

      {signedOut ? (
        <div className="op-banner error">
          You&apos;ve been signed out, so plays can&apos;t be saved. They are safe on this device.{" "}
          <a href={`/login?next=${encodeURIComponent(`/operator/${game.id}`)}`}>Sign in again</a> and they will send.
        </div>
      ) : offline ? (
        <div className="op-banner warn">
          Offline. Keep logging: plays are saved on this device and send when Wi-Fi is back. Don&apos;t refresh or close this page.
        </div>
      ) : (
        live.error && <div className="op-banner error">{live.error}</div>
      )}

      {/* Scoreboard + clock */}
      <section className="op-board">
        <div className="op-team">
          <span className="op-team-name">Broncos</span>
          <span className="op-score">{teamScore}</span>
          <span className="op-team-meta">
            Fouls {teamFoulCount} · TO {timeoutsUsed(allEvents, "team")}
            {opponentFoulCount >= game.bonusThreshold && <span className="bonus">Bonus</span>}
          </span>
        </div>

        <div className="op-clock-block">
          <span className="op-period">{periodLabel(game.currentPeriod, game.periodCount)}</span>
          {editingClock ? (
            <form
              className="op-clock-edit"
              onSubmit={(event) => {
                event.preventDefault();
                saveClock();
              }}
            >
              <input autoFocus inputMode="numeric" value={clockDraft} onChange={(event) => setClockDraft(event.target.value)} aria-label="Clock" />
              <button type="submit">Set</button>
              <button type="button" onClick={() => setEditingClock(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={`op-clock ${game.clockRunning ? "running" : ""}`}
              onClick={() => {
                setClockDraft(formatClock(live.clock));
                setEditingClock(true);
              }}
              title="Tap to correct the clock"
            >
              {formatClock(live.clock)}
            </button>
          )}
          <div className="op-clock-actions">
            {game.status === "scheduled" && !periodStarted ? (
              <button type="button" className="op-btn primary" disabled={busy} onClick={() => run(() => live.service.startPeriod(game.id, 1), "Q1 started")}>
                Start game (Q1)
              </button>
            ) : game.status === "final" ? (
              <button type="button" className="op-btn" disabled={busy} onClick={() => run(() => live.service.setStatus(game.id, "live"), "Game reopened")}>
                Reopen game
              </button>
            ) : (
              <>
                {!periodEnded && (
                  <button type="button" className={`op-btn ${game.clockRunning ? "stop" : "primary"}`} disabled={busy} onClick={toggleClock}>
                    {game.clockRunning ? <Pause size={18} /> : <Play size={18} />}
                    {game.clockRunning ? "Stop" : "Start"}
                  </button>
                )}
                {periodEnded ? (
                  <>
                    {(!regulationOver || tied) && (
                      <button
                        type="button"
                        className="op-btn"
                        disabled={periodBusy}
                        title={periodWait}
                        onClick={() => run(() => live.service.startPeriod(game.id, nextPeriod), `${periodLabel(nextPeriod, game.periodCount)} started`)}
                      >
                        Start {periodLabel(nextPeriod, game.periodCount)}
                      </button>
                    )}
                    {regulationOver && (
                      <button type="button" className="op-btn primary" disabled={periodBusy} title={periodWait} onClick={finishGame}>
                        Finish game
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="op-btn"
                    disabled={periodBusy}
                    title={periodWait}
                    onClick={() => {
                      if (live.clock > 0 && !window.confirm(`End ${periodLabel(game.currentPeriod, game.periodCount)} with ${formatClock(live.clock)} left?`)) return;
                      void run(() => live.service.endPeriod(game.id), `End of ${periodLabel(game.currentPeriod, game.periodCount)}`);
                    }}
                  >
                    End {periodLabel(game.currentPeriod, game.periodCount)}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="op-team">
          <span className="op-team-name">{game.opponent.shortName}</span>
          <span className="op-score">{opponentScore}</span>
          <span className="op-team-meta">
            Fouls {opponentFoulCount} · TO {timeoutsUsed(allEvents, "opponent")}
            {teamFoulCount >= game.bonusThreshold && <span className="bonus">Bonus</span>}
          </span>
        </div>
      </section>

      <div className="op-main">
        {/* Roster */}
        <section className="op-panel op-roster" aria-label="Players">
          <div className="op-panel-head">Broncos</div>
          <div className="op-roster-grid">
            {roster.map((player) => {
              const line = lines.get(player.athleteId);
              const pf = line?.pf ?? 0;
              return (
                <button
                  key={player.athleteId}
                  type="button"
                  className={`op-player ${selected === player.athleteId ? "selected" : ""} ${pendingAction ? "awaiting" : ""} ${pf >= FOULED_OUT ? "out" : pf === FOULED_OUT - 1 ? "trouble" : ""}`}
                  aria-pressed={selected === player.athleteId}
                  aria-label={`${playerName(player)}, ${line?.pts ?? 0} points, ${pf} fouls`}
                  onClick={() => onPlayer(player.athleteId)}
                >
                  <span className="op-player-number">{player.number ?? "–"}</span>
                  <span className="op-player-name">{player.name}</span>
                  <span className="op-player-line">
                    {line?.pts ?? 0} pts · {pf} PF{pf >= FOULED_OUT ? " · OUT" : ""}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className={`op-player team ${selected === "team" ? "selected" : ""} ${pendingAction ? "awaiting" : ""}`}
              aria-pressed={selected === "team"}
              aria-label="Team (team rebound or turnover)"
              onClick={() => onPlayer("team")}
            >
              <span className="op-player-number">T</span>
              <span className="op-player-name">Team</span>
              <span className="op-player-line">Team rebound / turnover</span>
            </button>
          </div>
        </section>

        {/* Actions */}
        <section className="op-panel op-actions" aria-label="Stats">
          <div className={`op-prompt ${pendingAction || selected ? "active" : ""}`}>
            <span>{prompt}</span>
            {(pendingAction || selected || spot) && (
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setPendingAction(null);
                  setSpot(null);
                }}
              >
                Clear
              </button>
            )}
          </div>

          {followUp && (
            <div className="op-followup">
              <span>{followUp.kind === "assist" ? "Assist by?" : "Offensive rebound?"}</span>
              <div className="op-chips">
                {roster
                  .filter((player) => followUp.kind === "rebound" || player.athleteId !== followUp.shooterId)
                  .map((player) => (
                    <button key={player.athleteId} type="button" onClick={() => onFollowUp(player.athleteId)}>
                      {player.number ?? player.name.split(" ")[0]}
                    </button>
                  ))}
                {followUp.kind === "rebound" && (
                  <button type="button" onClick={() => onFollowUp("team")}>
                    Team
                  </button>
                )}
                <button type="button" className="skip" onClick={() => onFollowUp(null)}>
                  {followUp.kind === "assist" ? "No assist" : "Not ours"}
                </button>
              </div>
            </div>
          )}

          <div className="op-grid shots">
            {SHOT_BUTTONS.map((button) => (
              <button
                key={button.type}
                type="button"
                className={`op-stat ${button.tone} ${pendingAction === button.type ? "armed" : ""}`}
                onClick={() => onAction(button.type)}
              >
                {button.label}
              </button>
            ))}
          </div>
          <div className="op-grid stats">
            {STAT_BUTTONS.map((button) => (
              <button
                key={button.type}
                type="button"
                className={`op-stat ${button.tone ?? ""} ${pendingAction === button.type ? "armed" : ""}`}
                onClick={() => onAction(button.type)}
              >
                {button.label}
              </button>
            ))}
            <button type="button" className="op-stat" onClick={() => log("team", "timeout", null)}>
              Timeout
            </button>
          </div>

          <div className="op-court-wrap">
            <Court
              className="op-court"
              shots={
                spot
                  ? [{ id: "spot", x: spot.x, y: spot.y, made: true, pending: true }]
                  : activeEvents(allEvents)
                      .filter((event) => event.side === "team" && event.shotX !== null && event.period === game.currentPeriod)
                      .map((event) => ({ id: event.id, x: event.shotX!, y: event.shotY!, made: EVENT_META[event.type].made }))
              }
            >
              <div className="op-court-target" onClick={onCourt} role="presentation" />
            </Court>
            {spot ? (
              <div className="op-spot-actions">
                <span>{threeSpot ? "3-point spot" : "2-point spot"}</span>
                <button type="button" className="op-stat make" onClick={() => onSpotResult(true)}>
                  Made {threeSpot ? "3" : "2"}
                </button>
                <button type="button" className="op-stat miss" onClick={() => onSpotResult(false)}>
                  Missed {threeSpot ? "3" : "2"}
                </button>
              </div>
            ) : (
              <p className="op-hint">Optional: tap where a shot was taken, then Made or Missed.</p>
            )}
          </div>
        </section>

        {/* Log */}
        <section className="op-panel op-log" aria-label="Play log">
          <div className="op-panel-head">
            Plays
            <button type="button" className="op-btn small" disabled={!undoable} onClick={() => undoable && toggleVoid(undoable)}>
              <Undo2 size={16} /> Undo last
            </button>
          </div>
          <ol className="op-log-list">
            {[...rows].reverse().map((row) => (
              <li key={row.event.id} className={`${row.event.voidedAt ? "voided" : ""} ${row.pending ? `pending ${row.pending}` : ""} ${row.event.side}`}>
                <span className="op-log-time">
                  {periodLabel(row.event.period, game.periodCount)} {row.event.side === "game" ? "" : formatClock(row.event.clockSecondsLeft)}
                </span>
                <span className="op-log-text">
                  {describeRow(row)}
                  {row.pending === "failed" && <em> · {row.error}</em>}
                  {row.pending === "waiting" && row.error && <em> · retrying</em>}
                </span>
                {row.event.side !== "game" && (
                  <button type="button" onClick={() => toggleVoid(row)} aria-label={row.event.voidedAt ? "Restore play" : "Remove play"}>
                    {row.event.voidedAt ? <RotateCcw size={15} /> : "✕"}
                  </button>
                )}
              </li>
            ))}
            {!rows.length && <li className="op-log-empty">Plays you log appear here.</li>}
          </ol>
        </section>
      </div>

      {/* Opponent */}
      <section className="op-opponent" aria-label={`${game.opponent.shortName} (team totals)`}>
        <span className="op-opponent-name">{game.opponent.shortName}</span>
        {(
          [
            ["fg2_made", "+2"],
            ["fg3_made", "+3"],
            ["ft_made", "+1 FT"],
            ["foul", "Foul"],
            ["timeout", "Timeout"],
          ] as const
        ).map(([type, label]) => (
          <button key={type} type="button" className={`op-stat ${type === "foul" ? "bad" : type === "timeout" ? "" : "opp"}`} onClick={() => log("opponent", type, null)}>
            {label}
          </button>
        ))}
      </section>

      <footer className="op-foot">
        <span>Space: start/stop clock · Ctrl+Z: undo · Esc: clear</span>
        {canAutoPlay && (
          <button type="button" onClick={() => setAutoPlay((value) => !value)} aria-pressed={autoPlay}>
            {autoPlay ? "Stop auto-play" : "Auto-play (demo game)"}
          </button>
        )}
        {isDemoMode && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset all demo games to their starting state?")) void resetDemo();
            }}
          >
            Reset demo data
          </button>
        )}
        <Link href={`/games/${game.id}`} target="_blank">
          Open public page ↗
        </Link>
      </footer>

      {toast && (
        <div className={`op-toast ${toast.error ? "error" : ""}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

function playerName(player: RosterPlayer | undefined) {
  if (!player) return "Player";
  return player.number === null ? player.name : `#${player.number} ${player.name}`;
}
