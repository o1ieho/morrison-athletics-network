import assert from "node:assert/strict";
import { test } from "node:test";
import { inCatchUpWindow, isSinglePlayChange, sortArrivals } from "./catch-up.ts";

test("catch-up window after a wake, reconnect or load", () => {
  assert.equal(inCatchUpWindow(10_000, [8_000]), true);
  assert.equal(inCatchUpWindow(13_000, [8_000]), false);
  assert.equal(inCatchUpWindow(13_000, [8_000, 12_500]), true);
  assert.equal(inCatchUpWindow(7_000, [8_000]), false, "a mark in the future doesn't count");
  assert.equal(inCatchUpWindow(10_000, []), false);
});

test("only one play's worth of score change animates", () => {
  assert.equal(isSinglePlayChange(1), true);
  assert.equal(isSinglePlayChange(3), true);
  assert.equal(isSinglePlayChange(-2), true, "an undone basket");
  assert.equal(isSinglePlayChange(0), false);
  assert.equal(isSinglePlayChange(4), false);
  assert.equal(isSinglePlayChange(34), false);
  assert.equal(isSinglePlayChange(-7), false);
});

test("new plays show as new one or two at a time, never as a batch", () => {
  const known = new Set(["a", "b"]);
  assert.deepEqual(sortArrivals(known, ["a", "b", "c"], false), { fresh: ["c"], settled: [] });
  assert.deepEqual(sortArrivals(known, ["a", "b", "c", "d", "e"], false), { fresh: ["c", "d", "e"], settled: [] });
  assert.deepEqual(sortArrivals(known, ["a", "c", "d", "e", "f"], false), { fresh: [], settled: ["c", "d", "e", "f"] });
  assert.deepEqual(sortArrivals(known, ["a", "c"], true), { fresh: [], settled: ["c"] });
  assert.deepEqual(sortArrivals(known, ["a", "b"], false), { fresh: [], settled: [] });
});
