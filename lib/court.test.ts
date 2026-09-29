import assert from "node:assert/strict";
import { test } from "node:test";
import { isThreePointSpot } from "./court.ts";

const at = (meters: { x: number; y: number }) => isThreePointSpot(meters.x / 15, meters.y / 14);

test("three-point detection follows the FIBA line", () => {
  assert.equal(at({ x: 7.5, y: 1.575 + 6.5 }), false, "just inside the top of the arc");
  assert.equal(at({ x: 7.5, y: 1.575 + 7.0 }), true, "just outside the top of the arc");
  assert.equal(at({ x: 0.5, y: 1.0 }), true, "left corner");
  assert.equal(at({ x: 1.2, y: 1.0 }), false, "inside the corner line");
  assert.equal(at({ x: 14.5, y: 2.0 }), true, "right corner");
  assert.equal(at({ x: 7.5, y: 3.0 }), false, "in the paint");
});
