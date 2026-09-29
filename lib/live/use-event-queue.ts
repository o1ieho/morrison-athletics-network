"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent } from "@/lib/types";
import { PermanentError, type LiveService, type NewEvent } from "./service";

export type QueuedEvent = {
  input: NewEvent;
  queuedAt: string;
  state: "sending" | "waiting" | "failed";
  error?: string;
  /** Set when the operator undoes a play that was still in flight. */
  cancel?: boolean;
};

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

function storageKey(gameId: string) {
  return `ssn-queue-${gameId}`;
}

function loadQueue(gameId: string): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(storageKey(gameId));
    const items = raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
    // Anything that was mid-send when the page closed gets retried.
    return items.map((item) => (item.state === "sending" ? { ...item, state: "waiting" } : item));
  } catch {
    return [];
  }
}

/**
 * Sends plays to the server one at a time, in order. Plays wait in a queue
 * (saved to localStorage, so a refresh doesn't lose them) and are retried with
 * backoff when the network drops. Events carry client-generated ids, so a retry
 * after a lost response can't create a duplicate.
 */
export function useEventQueue(service: LiveService, gameId: string, onSaved: (event: GameEvent) => void) {
  const [items, setItems] = useState<QueuedEvent[]>([]);
  const busy = useRef(false);
  const attempts = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const [wake, setWake] = useState(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    setItems(loadQueue(gameId));
  }, [gameId]);

  useEffect(() => {
    try {
      if (items.length) localStorage.setItem(storageKey(gameId), JSON.stringify(items));
      else localStorage.removeItem(storageKey(gameId));
    } catch {
      // Storage unavailable: the queue still works in memory.
    }
  }, [gameId, items]);

  useEffect(() => {
    if (busy.current) return;
    const next = items.find((item) => item.state !== "failed");
    if (!next || (next.state === "waiting" && retryTimer.current !== null)) return;

    busy.current = true;
    setItems((current) => current.map((item) => (item.input.id === next.input.id ? { ...item, state: "sending" } : item)));

    service
      .addEvent(gameId, next.input)
      .then(async (saved) => {
        attempts.current = 0;
        const cancelled = itemsRef.current.find((item) => item.input.id === saved.id)?.cancel;
        const final = cancelled ? await service.setVoided(saved.id, true).catch(() => saved) : saved;
        onSaved(final);
        setItems((current) => current.filter((item) => item.input.id !== saved.id));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not save";
        if (error instanceof PermanentError) {
          setItems((current) => current.map((item) => (item.input.id === next.input.id ? { ...item, state: "failed", error: message } : item)));
          return;
        }
        const delay = RETRY_DELAYS_MS[Math.min(attempts.current, RETRY_DELAYS_MS.length - 1)];
        attempts.current += 1;
        setItems((current) => current.map((item) => (item.input.id === next.input.id ? { ...item, state: "waiting", error: message } : item)));
        retryTimer.current = window.setTimeout(() => {
          retryTimer.current = null;
          setWake((value) => value + 1);
        }, delay);
      })
      .finally(() => {
        busy.current = false;
        setWake((value) => value + 1);
      });
  }, [gameId, items, onSaved, service, wake]);

  // Retry straight away when the browser says the network is back.
  useEffect(() => {
    const online = () => {
      if (retryTimer.current !== null) {
        window.clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      attempts.current = 0;
      setWake((value) => value + 1);
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);

  // Warn before closing the tab with unsent plays.
  useEffect(() => {
    if (!items.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [items.length]);

  const enqueue = useCallback((input: NewEvent) => {
    setItems((current) => [...current, { input, queuedAt: new Date().toISOString(), state: "waiting" }]);
  }, []);

  /** Removes a queued play; one already in flight is voided as soon as it lands. */
  const cancel = useCallback((id: string) => {
    setItems((current) =>
      current.flatMap((item) => {
        if (item.input.id !== id) return [item];
        return item.state === "sending" ? [{ ...item, cancel: true }] : [];
      }),
    );
  }, []);

  const retryFailed = useCallback(() => {
    attempts.current = 0;
    setItems((current) => current.map((item) => (item.state === "failed" ? { ...item, state: "waiting", error: undefined } : item)));
  }, []);

  return { items, enqueue, cancel, retryFailed };
}
