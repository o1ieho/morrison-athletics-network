"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clockSecondsLeft } from "@/lib/basketball";
import { isDemoMode } from "@/lib/config";
import type { Game, GameEvent } from "@/lib/types";
import { createLocalLiveService } from "./local";
import type { ConnectionStatus, LiveService, LiveSnapshot } from "./service";
import { createSupabaseLiveService } from "./supabase";

let service: LiveService | null = null;

/** While the live connection is down (e.g. venue Wi-Fi blocks it), re-read the game this often. */
export const POLL_MS = 10_000;
/** While connected to a live game, re-read it this often anyway, in case the connection died silently. */
export const HEARTBEAT_MS = 60_000;

export function getLiveService(): LiveService {
  service ??= isDemoMode ? createLocalLiveService() : createSupabaseLiveService();
  return service;
}

function newer(current: Game, incoming: Game) {
  return Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt);
}

function upsertEvent(events: GameEvent[], event: GameEvent) {
  const index = events.findIndex((entry) => entry.id === event.id);
  if (index === -1) return [...events, event];
  const next = [...events];
  next[index] = event;
  return next;
}

/**
 * Keeps one game's state in sync: loads it, applies realtime changes, reloads
 * after a reconnect or when a phone wakes up, and ticks the clock locally.
 * If the realtime connection is down or blocked, it falls back to re-reading
 * the game every 10 seconds, so a live game never freezes.
 */
export function useLiveGame(gameId: string, initial?: LiveSnapshot | null) {
  const live = getLiveService();
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(initial ?? null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(Boolean(initial));
  const [serverOffset, setServerOffset] = useState(0);
  /** When the last full load succeeded (for "last update 2m ago"). */
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastStatus = useRef<ConnectionStatus>("connecting");
  /** When each event was last applied on this device (a save, an undo or a realtime change). */
  const touched = useRef(new Map<string, number>());

  const reload = useCallback(async () => {
    try {
      const startedAt = Date.now();
      const fresh = await live.load(gameId);
      setSnapshot((current) => {
        if (!fresh) return null;
        if (!current) return fresh;
        // Plays saved or undone while the load was in flight are newer than
        // what the load returned, so they win. Without this a play could
        // vanish from the log, or an undo could flip back.
        const recent = current.events.filter((event) => (touched.current.get(event.id) ?? 0) >= startedAt);
        const events = recent.reduce(upsertEvent, fresh.events);
        // Same for a realtime game update that arrived during the load.
        const game = newer(current.game, fresh.game) ? fresh.game : { ...fresh.game, ...current.game };
        return { ...fresh, game, events };
      });
      setError(null);
      setSyncedAt(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the game");
    } finally {
      setLoaded(true);
    }
  }, [gameId, live]);

  useEffect(() => {
    // Subscribe before loading so nothing that happens in between is missed.
    const unsubscribe = live.subscribe(gameId, {
      onGame: (game) =>
        setSnapshot((current) => (current && newer(current.game, game) ? { ...current, game: { ...current.game, ...game } } : current)),
      onEvent: (event) => {
        touched.current.set(event.id, Date.now());
        setSnapshot((current) => (current ? { ...current, events: upsertEvent(current.events, event) } : current));
      },
      onStatus: (next) => {
        // Catch up on anything missed while disconnected.
        if (next === "live" && lastStatus.current === "reconnecting") void reload();
        lastStatus.current = next;
        setStatus(next);
      },
    });
    void reload();
    void live.measureServerOffset().then(setServerOffset);

    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [gameId, live, reload]);

  // Polling fallback. Only for games that can still change (live, or about to
  // tip off), and only while the page is on screen.
  const gameStatus = snapshot?.game.status;
  const canChange = gameStatus === "live" || gameStatus === "scheduled";
  useEffect(() => {
    if (!canChange) return;
    const every = status === "live" ? (gameStatus === "live" ? HEARTBEAT_MS : null) : POLL_MS;
    if (every === null) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, every);
    return () => window.clearInterval(timer);
  }, [canChange, gameStatus, status, reload]);

  const running = snapshot?.game.clockRunning ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  const clock = snapshot ? clockSecondsLeft(snapshot.game, running ? now : Date.now(), serverOffset) : 0;

  const applyGame = useCallback((game: Game) => {
    setSnapshot((current) => (current && newer(current.game, game) ? { ...current, game: { ...current.game, ...game } } : current));
  }, []);

  const applyEvent = useCallback((event: GameEvent) => {
    touched.current.set(event.id, Date.now());
    setSnapshot((current) => (current ? { ...current, events: upsertEvent(current.events, event) } : current));
  }, []);

  const events = useMemo(
    () => [...(snapshot?.events ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    [snapshot?.events],
  );

  return {
    snapshot,
    game: snapshot?.game ?? null,
    events,
    roster: snapshot?.roster ?? [],
    clock,
    serverOffset,
    status,
    syncedAt,
    error,
    loaded,
    reload,
    applyGame,
    applyEvent,
    service: live,
  };
}

export type LiveGameState = ReturnType<typeof useLiveGame>;
