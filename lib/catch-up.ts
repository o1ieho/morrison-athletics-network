// Telling live changes from catch-ups. When a phone wakes up, the live
// connection reconnects, or the page first loads over server-rendered HTML,
// several plays can land at once. Those shouldn't look like something that
// just happened: no "+N" tag, no rolling digits, no "new play" rows. Pure
// functions, so they're easy to test; the browser side is lib/use-catch-up.ts.

/** How long after a wake, reconnect or page load changes count as catching up. */
export const CATCH_UP_WINDOW_MS = 5000;

/** More new plays than this in one update is a catch-up, not live play-by-play. */
export const MAX_LIVE_BATCH = 3;

/** True when `now` is within `windowMs` after any of the catch-up start times. */
export function inCatchUpWindow(now: number, marks: readonly number[], windowMs = CATCH_UP_WINDOW_MS): boolean {
  return marks.some((mark) => now >= mark && now - mark < windowMs);
}

/** A score change one play could make: a basket (1–3 points) or one undone basket. */
export function isSinglePlayChange(delta: number): boolean {
  const size = Math.abs(delta);
  return size >= 1 && size <= 3;
}

/**
 * Splits plays not seen before into ones to show as new (`fresh`) and ones to
 * add quietly (`settled`). Everything settles quietly while catching up or
 * when more than `maxBatch` arrive at once.
 */
export function sortArrivals(
  known: ReadonlySet<string>,
  ids: readonly string[],
  catchingUp: boolean,
  maxBatch = MAX_LIVE_BATCH,
): { fresh: string[]; settled: string[] } {
  const arrived = ids.filter((id) => !known.has(id));
  if (catchingUp || arrived.length > maxBatch) return { fresh: [], settled: arrived };
  return { fresh: arrived, settled: [] };
}
