import assert from "node:assert/strict";
import test from "node:test";
import { parseGameTab } from "./game-tabs.ts";

test("known tabs come through", () => {
  assert.equal(parseGameTab("box"), "box");
  assert.equal(parseGameTab("plays"), "plays");
  assert.equal(parseGameTab("stats"), "stats");
});

test("missing, unknown or repeated values fall back sensibly", () => {
  assert.equal(parseGameTab(undefined), "gamecast");
  assert.equal(parseGameTab(null), "gamecast");
  assert.equal(parseGameTab("evil"), "gamecast");
  assert.equal(parseGameTab(["box", "stats"]), "box");
});

test("a #play- link opens the play-by-play whatever ?tab= says", () => {
  assert.equal(parseGameTab("box", "#play-123"), "plays");
  assert.equal(parseGameTab(undefined, "#other"), "gamecast");
});
