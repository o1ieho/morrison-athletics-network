"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent } from "@/lib/types";
import { AUTH_ERROR_CODES, PermanentError, type LiveService, type NewEvent } from "./service";

export type QueuedEvent = {
  input: NewEvent;
  queuedAt: string;
  state: "sending" | "waiting" | "failed";
  error?: string;
  /** True when the save was refused because the operator is signed out. */
  authError?: boolean;
  /**
   * Set when the operator removes a play that may already have reached the
   * server. The play stays in the queue until it is confirmed saved and then
   * undone there, so it can never come back as a counted play.
   */
  cancel?: boolean;
  /** True once a send has started: the server may have the play even if no reply came back. */
  attempted?: boolean;
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
    // Plays refused for being signed out are retried too: the page usually
    // reloads right after signing back in.
    return items.map((item) => (item.state === "sending" || item.authError ? { ...item, state: "waiting", authError: false } : item));
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
    setItems((current) => current.map((item) => (item.input.id === next.input.id ? { ...item, state: "sending", attempted: true } : item)));

    service
      .addEvent(gameId, next.input)
      .then(async (saved) => {
        const cancelled = itemsRef.current.find((item) => item.input.id === saved.id)?.cancel;
        // A removed play is undone on the server before it leaves the queue.
        // If the undo fails, the whole step is retried (saving again is harmless).
        const final = cancelled ? await service.setVoided(saved.id, true) : saved;
        attempts.current = 0;
        onSaved(final);
        setItems((current) => current.filter((item) => item.input.id !== saved.id));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not save";
        if (error instanceof PermanentError) {
          const authError = AUTH_ERROR_CODES.has(error.code ?? "");
          setItems((current) =>
            current.flatMap((item) => {
              if (item.input.id !== next.input.id) return [item];
              // The server refused a play the operator already removed: nothing left to undo.
              if (item.cancel && !authError) return [];
              return [{ ...item, state: "failed" as const, error: message, authError }];
            }),
          );
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

  // Retry straight away when the network is back or the iPad wakes up,
  // instead of waiting out the retry delay.
  useEffect(() => {
    const resume = () => {
      if (retryTimer.current !== null) {
        window.clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      attempts.current = 0;
      // Removed plays that failed still need their undo to reach the server.
      setItems((current) =>
        current.some((item) => item.cancel && item.state === "failed")
          ? current.map((item) => (item.cancel && item.state === "failed" ? { ...item, state: "waiting", error: undefined } : item))
          : current,
      );
      setWake((value) => value + 1);
    };
    const visible = () => {
      if (document.visibilityState === "visible") resume();
    };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", visible);
    };
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

  /**
   * Removes a queued play. One that was never sent is simply dropped. One that
   * was sent at least once may be on the server even though no reply came
   * back, so it stays queued (hidden) until it is saved and undone there.
   */
  const cancel = useCallback((id: string) => {
    setItems((current) =>
      current.flatMap((item) => {
        if (item.input.id !== id) return [item];
        if (!item.attempted) return [];
        return [{ ...item, cancel: true, state: item.state === "failed" ? "waiting" : item.state, error: undefined }];
      }),
    );
  }, []);

  const retryFailed = useCallback(() => {
    attempts.current = 0;
    setItems((current) => current.map((item) => (item.state === "failed" ? { ...item, state: "waiting", error: undefined, authError: false } : item)));
  }, []);

  return { items, enqueue, cancel, retryFailed };
}
