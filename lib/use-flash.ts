"use client";

import { useEffect, useRef, useState } from "react";
import { isCatchingUp } from "./use-catch-up.ts";

export type Flash<T> = {
  /** 0 until `value` first changes after mount, then counts up with every change. */
  key: number;
  /** The value before the latest change. */
  previous: T | undefined;
  /** value − previous for numbers (0 otherwise), e.g. +3 for a made 3-pointer. */
  delta: number;
  /**
   * The latest change happened live, as a single change while you watched.
   * False for a catch-up (a phone waking, a reconnect, the first load after
   * the server's HTML) or when `isLive` rejects it: those update quietly.
   */
  live: boolean;
};

/**
 * Tracks changes to `value` after the first render. Values already on screen
 * when the page loads never count as a change, so they don't animate; only
 * live updates do. Use `key` as a React key so the element remounts and
 * replays its CSS "just changed" animation, and check `live` before playing it.
 */
export function useFlash<T>(value: T, isLive?: (previous: T, next: T) => boolean): Flash<T> {
  const [flash, setFlash] = useState<Flash<T>>({ key: 0, previous: undefined, delta: 0, live: false });
  const last = useRef(value);
  const check = useRef(isLive);
  check.current = isLive;
  useEffect(() => {
    if (last.current !== value) {
      const previous = last.current;
      last.current = value;
      const delta = typeof value === "number" && typeof previous === "number" ? value - previous : 0;
      const live = !isCatchingUp() && (check.current?.(previous, value) ?? true);
      setFlash((current) => ({ key: current.key + 1, previous, delta, live }));
    }
  }, [value]);
  return flash;
}

/**
 * A number that changes whenever `value` changes live after the first render
 * (0 after a catch-up change), for use as a React key and an "animate" flag.
 */
export function useFlashKey(value: unknown) {
  const flash = useFlash(value);
  return flash.live ? flash.key : 0;
}

/**
 * True for `ms` after `key` changes (and never for key 0, the first render).
 * Used to keep an outgoing element (an old digit, a "+3" tag) in the DOM only
 * as long as its animation runs.
 */
export function useBriefly(key: number, ms: number) {
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    if (!key) return;
    const timer = window.setTimeout(() => setSettled(key), ms);
    return () => window.clearTimeout(timer);
  }, [key, ms]);
  return key > settled;
}
