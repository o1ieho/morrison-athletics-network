"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clockSecondsLeft } from "@/lib/basketball";
import { isDemoMode } from "@/lib/config";
import type { Game, GameEvent } from "@/lib/types";
import { createLocalLiveService } from "./local";
import type { ConnectionStatus, LiveService, LiveSnapshot } from "./service";
import { createSupabaseLiveService } from "./supabase";

let service: LiveService | null = null;

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
 */
export function useLiveGame(gameId: string, initial?: LiveSnapshot | null) {
  const live = getLiveService();
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(initial ?? null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(Boolean(initial));
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const lastStatus = useRef<ConnectionStatus>("connecting");

  const reload = useCallback(async () => {
    try {
      const fresh = await live.load(gameId);
      setSnapshot((current) => {
        if (!fresh) return null;
        // Keep a realtime update that arrived while the load was in flight.
        if (current && !newer(current.game, fresh.game)) return { ...fresh, game: { ...fresh.game, ...current.game } };
        return fresh;
      });
      setError(null);
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
      onEvent: (event) => setSnapshot((current) => (current ? { ...current, events: upsertEvent(current.events, event) } : current)),
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
    error,
    loaded,
    reload,
    applyGame,
    applyEvent,
    service: live,
  };
}

export type LiveGameState = ReturnType<typeof useLiveGame>;
