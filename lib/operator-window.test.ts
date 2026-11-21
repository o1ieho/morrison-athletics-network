import assert from "node:assert/strict";
import test from "node:test";
import { canOperateGame } from "./operator-window.ts";

const tipOff = Date.parse("2026-11-28T10:00:00Z");
const game = { startsAt: new Date(tipOff).toISOString() };
const operator = { isAdmin: false, canOperate: true };
const admin = { isAdmin: true, canOperate: true };
const hour = 60 * 60 * 1000;

test("an operator can run a game from 12 hours before to 12 hours after tip-off", () => {
  assert.equal(canOperateGame(game, operator, tipOff - 12 * hour), true);
  assert.equal(canOperateGame(game, operator, tipOff), true);
  assert.equal(canOperateGame(game, operator, tipOff + 12 * hour), true);
});

test("outside the window an operator can't, but an admin always can", () => {
  assert.equal(canOperateGame(game, operator, tipOff - 13 * hour), false);
  assert.equal(canOperateGame(game, operator, tipOff + 13 * hour), false);
  assert.equal(canOperateGame(game, admin, tipOff + 30 * 24 * hour), true);
});

test("someone with no operator role never can", () => {
  assert.equal(canOperateGame(game, { isAdmin: false, canOperate: false }, tipOff), false);
});
