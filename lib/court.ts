// FIBA half-court geometry in meters. Shot spots are stored normalized to 0..1
// (x across the baseline, y from the baseline toward half court).

export const COURT = {
  width: 15,
  depth: 14,
  basket: { x: 7.5, y: 1.575 },
  threeRadius: 6.75,
  /** Corner three lines run parallel to the sideline, 0.9 m in from it. */
  cornerX: 0.9,
  laneHalfWidth: 2.45,
  freeThrowY: 5.8,
  circleRadius: 1.8,
  restrictedRadius: 1.25,
  backboardY: 1.2,
};

/** y where the three-point arc meets the straight corner lines. */
export const CORNER_ARC_Y =
  COURT.basket.y + Math.sqrt(COURT.threeRadius ** 2 - (COURT.basket.x - COURT.cornerX) ** 2);

/** True when a normalized spot is beyond the three-point line. */
export function isThreePointSpot(x: number, y: number): boolean {
  const mx = x * COURT.width;
  const my = y * COURT.depth;
  if (my <= CORNER_ARC_Y) return mx < COURT.cornerX || mx > COURT.width - COURT.cornerX;
  return Math.hypot(mx - COURT.basket.x, my - COURT.basket.y) > COURT.threeRadius;
}
