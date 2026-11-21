"use client";

import { useEffect, useRef } from "react";
import { inCatchUpWindow } from "./catch-up.ts";
import type { ConnectionStatus } from "./live/service";

// When catch-ups started on this page: the page or a live view mounting, the
// tab becoming visible again, and the live connection coming back. Shared by
// every component, so the score, the feed and the live bar agree.
const marks: number[] = [];
let listening = false;

function listen() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") markCatchUp();
  });
}

export function markCatchUp() {
  marks.push(Date.now());
  // Only the latest few matter.
  if (marks.length > 20) marks.splice(0, marks.length - 20);
}

/**
 * True while changes should be treated as catching up rather than live: in a
 * hidden tab, and for a few seconds after a wake, reconnect or mount. On the
 * server it's always true (nothing there animates anyway).
 */
export function isCatchingUp(now = Date.now()) {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "hidden" || inCatchUpWindow(now, marks);
}

/**
 * Call in each live view. Marks a catch-up when it mounts (the first reload
 * after server-rendered HTML) and whenever the live connection comes back.
 */
export function useCatchUp(status?: ConnectionStatus) {
  useEffect(() => {
    listen();
    markCatchUp();
  }, []);
  const previous = useRef(status);
  useEffect(() => {
    if (status === "live" && previous.current !== "live") markCatchUp();
    previous.current = status;
  }, [status]);
}
