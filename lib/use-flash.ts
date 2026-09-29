"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a number that changes whenever `value` changes after the first
 * render. Use it as a React key so the element remounts and replays its CSS
 * "just changed" animation (e.g. a score going up).
 */
export function useFlashKey(value: unknown) {
  const [key, setKey] = useState(0);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setKey((current) => current + 1);
    }
  }, [value]);
  return key;
}
