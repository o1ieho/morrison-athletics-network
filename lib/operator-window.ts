/**
 * Stat operators can run a game only on its game day: from this long before
 * tip-off until this long after. Admins can change any game at any time.
 * The database enforces the same window (can_operate_game in
 * supabase/migrations/20261121000000_operator_game_day.sql); this copy only
 * decides what the operator screens show.
 */
export const OPERATOR_WINDOW_HOURS = 12;

const WINDOW_MS = OPERATOR_WINDOW_HOURS * 60 * 60 * 1000;

export function canOperateGame(game: { startsAt: string }, user: { isAdmin: boolean; canOperate: boolean }, now = Date.now()) {
  if (user.isAdmin) return true;
  if (!user.canOperate) return false;
  const tipOff = Date.parse(game.startsAt);
  return now >= tipOff - WINDOW_MS && now <= tipOff + WINDOW_MS;
}
