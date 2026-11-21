import assert from "node:assert/strict";
import test from "node:test";
import { formatPct, rankStandings } from "./standings.ts";

test("ranks by win percentage", () => {
  const rows = rankStandings([
    { id: "a", name: "Alpha", wins: 3, losses: 3 },
    { id: "b", name: "Broncos", wins: 5, losses: 1, broncos: true },
    { id: "c", name: "Charlie", wins: 4, losses: 1 },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ["b", "c", "a"]);
});

test("identical records share a rank", () => {
  const rows = rankStandings([
    { id: "a", name: "Alpha", wins: 2, losses: 1 },
    { id: "b", name: "Bravo", wins: 2, losses: 1 },
    { id: "c", name: "Charlie", wins: 0, losses: 3 },
  ]);
  assert.deepEqual(rows.map((row) => row.rank), [1, 1, 3]);
});

test("teams that haven't played sort last at .000", () => {
  const rows = rankStandings([
    { id: "z", name: "Zulu", wins: 0, losses: 0 },
    { id: "a", name: "Alpha", wins: 1, losses: 2 },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ["a", "z"]);
  assert.equal(formatPct(rows[1].pct), ".000");
});

test("formatting", () => {
  assert.equal(formatPct(0.75), ".750");
  assert.equal(formatPct(1), "1.000");
});
