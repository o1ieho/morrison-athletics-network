"use client";

import { useEffect, useRef, useState } from "react";

export type Flash<T> = {
  /** 0 until `value` first changes after mount, then counts up with every change. */
  key: number;
  /** The value before the latest change. */
  previous: T | undefined;
  /** value − previous for numbers (0 otherwise), e.g. +3 for a made 3-pointer. */
  delta: number;
};

/**
 * Tracks changes to `value` after the first render. Values already on screen
 * when the page loads never count as a change, so they don't animate; only
 * live updates do. Use `key` as a React key so the element remounts and
 * replays its CSS "just changed" animation.
 */
export function useFlash<T>(value: T): Flash<T> {
  const [flash, setFlash] = useState<Flash<T>>({ key: 0, previous: undefined, delta: 0 });
  const last = useRef(value);
  useEffect(() => {
    if (last.current !== value) {
      const previous = last.current;
      last.current = value;
      const delta = typeof value === "number" && typeof previous === "number" ? value - previous : 0;
      setFlash((current) => ({ key: current.key + 1, previous, delta }));
    }
  }, [value]);
  return flash;
}

/** Just the key from useFlash: a number that changes whenever `value` changes after the first render. */
export function useFlashKey(value: unknown) {
  return useFlash(value).key;
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
