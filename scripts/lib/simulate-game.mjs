// Deterministic basketball game simulator.
//
// Produces a list of game events shaped like rows of public.game_events, used
// for the demo seed and for exercising the live pipeline end to end. The same
// seed always yields the same game.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FIBA half court in meters: 15 wide, 14 deep, basket 1.575 m from the baseline.
// Matches components/court.tsx.
const COURT_W = 15;
const COURT_H = 14;
const BASKET = { x: 7.5, y: 1.575 };

function shotSpot(rand, isThree) {
  for (;;) {
    const angle = rand() * Math.PI;
    const radius = isThree ? 6.9 + rand() * 1.2 : 0.4 + rand() * 5.6;
    const x = BASKET.x + Math.cos(angle) * radius;
    const y = BASKET.y + Math.sin(angle) * radius;
    // Threes must be beyond the corner lines too (6.6 m from the basket's axis).
    const beyondCorner = Math.abs(x - BASKET.x) > 6.7 || y > BASKET.y + 1.5;
    if (x > 0.3 && x < COURT_W - 0.3 && y > 0.2 && y < COURT_H - 0.5 && (!isThree || beyondCorner)) {
      return { shot_x: +(x / COURT_W).toFixed(4), shot_y: +(y / COURT_H).toFixed(4) };
    }
  }
}

function pickWeighted(rand, items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = rand() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * @param {object} options
 * @param {string[]} options.athleteIds MAT players, best scorers first.
 * @param {number} [options.seed]
 * @param {number} [options.periods] Periods to simulate (can stop mid-game).
 * @param {number} [options.periodLengthSeconds]
 * @param {number} [options.stopAtSecondsLeft] In the last period, stop when the clock reaches this.
 * @returns {Array<{side: string, athlete_id: string|null, event_type: string, period: number,
 *   clock_seconds_left: number, shot_x: number|null, shot_y: number|null, offset_seconds: number}>}
 */
export function simulateGame({
  athleteIds,
  seed = 1,
  periods = 4,
  periodLengthSeconds = 480,
  stopAtSecondsLeft = 0,
}) {
  const rand = mulberry32(seed);
  const events = [];
  // Real time drifts ahead of game time (stoppages, free throws, breaks).
  let offset = 0;
  const usage = athleteIds.map((id, index) => ({ id, weight: Math.max(1, athleteIds.length - index) ** 1.4 }));
  const player = () => pickWeighted(rand, usage, (p) => p.weight).id;

  function push(period, clock, side, type, extra = {}) {
    events.push({
      side,
      athlete_id: null,
      event_type: type,
      period,
      clock_seconds_left: Math.max(0, Math.round(clock)),
      shot_x: null,
      shot_y: null,
      offset_seconds: Math.round(offset),
      ...extra,
    });
    offset += 3 + rand() * 6;
  }

  for (let period = 1; period <= periods; period += 1) {
    const isLast = period === periods;
    const stopAt = isLast ? stopAtSecondsLeft : 0;
    let clock = periodLengthSeconds;
    let teamHasBall = period % 2 === 1;
    push(period, clock, "game", "period_start");

    while (clock - 8 > stopAt) {
      clock -= 8 + rand() * 16;
      const shooterSide = teamHasBall ? "team" : "opponent";
      const roll = rand();

      if (roll < 0.13) {
        // Turnover (MAT only records its own, plus steals against the opponent).
        if (teamHasBall) {
          push(period, clock, "team", "turnover", { athlete_id: player() });
        } else {
          push(period, clock, "team", "steal", { athlete_id: player() });
        }
        teamHasBall = !teamHasBall;
        continue;
      }

      if (roll < 0.22) {
        // Shooting foul: two free throws.
        if (teamHasBall) {
          push(period, clock, "opponent", "foul");
          const shooter = player();
          for (let i = 0; i < 2; i += 1) {
            push(period, clock, "team", rand() < 0.68 ? "ft_made" : "ft_miss", { athlete_id: shooter });
          }
        } else {
          push(period, clock, "team", "foul", { athlete_id: player() });
          for (let i = 0; i < 2; i += 1) {
            push(period, clock, "opponent", rand() < 0.66 ? "ft_made" : "ft_miss");
          }
        }
        teamHasBall = !teamHasBall;
        continue;
      }

      const isThree = rand() < 0.33;
      const made = rand() < (isThree ? 0.33 : 0.47);
      const type = `${isThree ? "fg3" : "fg2"}_${made ? "made" : "miss"}`;
      const shooter = teamHasBall ? player() : null;
      const blocked = !teamHasBall && !made && !isThree && rand() < 0.12;

      push(period, clock, shooterSide, type, {
        athlete_id: shooter,
        ...(teamHasBall ? shotSpot(rand, isThree) : {}),
      });

      if (blocked) push(period, clock, "team", "block", { athlete_id: player() });

      if (made) {
        if (teamHasBall && rand() < 0.55) {
          let passer = player();
          if (passer === shooter) passer = athleteIds.find((id) => id !== shooter) ?? passer;
          push(period, clock, "team", "assist", { athlete_id: passer });
        }
        teamHasBall = !teamHasBall;
        continue;
      }

      // Missed shot: someone rebounds. MAT rebounds are recorded per player.
      const offensive = rand() < 0.27;
      const teamRebounds = teamHasBall ? offensive : !offensive;
      if (teamRebounds) {
        push(period, clock, "team", teamHasBall ? "rebound_off" : "rebound_def", { athlete_id: player() });
      }
      if (!offensive) teamHasBall = !teamHasBall;

      if (rand() < 0.02) push(period, clock, rand() < 0.5 ? "team" : "opponent", "timeout");
    }

    if (stopAt === 0) {
      push(period, 0, "game", "period_end");
      offset += 60;
    }
  }

  return events;
}
