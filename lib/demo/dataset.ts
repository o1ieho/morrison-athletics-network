// Turns data/seed/demo.json into full app records, with game times relative to
// `nowMs`. Used by demo mode on the server (public pages) and, via
// /api/demo, as the starting state of the browser-side demo store.

import demo from "@/data/seed/demo.json";
import { pointsFor } from "@/lib/basketball";
import type { EventType, Game, GameEvent, Opponent, RosterPlayer, Season, Side, Team } from "@/lib/types";

export type DemoDataset = {
  season: Season;
  teams: Team[];
  roster: RosterPlayer[];
  opponents: Opponent[];
  games: Game[];
  events: GameEvent[];
};

const HOUR = 3600_000;

let serverSnapshot: DemoDataset | null = null;

/** One snapshot per server process, so demo game times stay put between requests. */
export function getServerDemoDataset(): DemoDataset {
  serverSnapshot ??= materializeDemo(Date.now());
  return serverSnapshot;
}

export function materializeDemo(nowMs: number): DemoDataset {
  const teams: Team[] = demo.teams.map((team) => ({
    id: team.id,
    slug: team.slug,
    name: team.name,
    gender: team.gender as Team["gender"],
    level: team.level as Team["level"],
    conference: "TISSA",
    seasonStatus: "active",
  }));

  const games: Game[] = [];
  const events: GameEvent[] = [];

  for (const source of demo.games) {
    let startsMs = nowMs + source.startsIn * 1000;
    if (source.roundToHour) startsMs = Math.floor(startsMs / HOUR) * HOUR;

    const gameEvents: GameEvent[] = source.events.map((event, index) => ({
      id: `${source.id}-${String(index).padStart(4, "0")}`,
      gameId: source.id,
      side: event.side as Side,
      athleteId: event.athleteId,
      type: event.type as EventType,
      period: event.period,
      clockSecondsLeft: event.clockSecondsLeft,
      points: pointsFor(event.type as EventType),
      shotX: event.shotX,
      shotY: event.shotY,
      createdAt: new Date(startsMs + event.offsetSeconds * 1000).toISOString(),
      voidedAt: null,
    }));
    events.push(...gameEvents);

    const score = (side: Side) => gameEvents.filter((event) => event.side === side).reduce((sum, event) => sum + event.points, 0);

    games.push({
      id: source.id,
      seasonId: demo.season.id,
      teamId: source.teamId,
      opponentId: source.opponentId,
      isHome: source.isHome,
      startsAt: new Date(startsMs).toISOString(),
      location: source.location,
      status: source.status as Game["status"],
      scoringMode: source.scoringMode as Game["scoringMode"],
      teamScore: source.manualScore ? source.manualScore[0] : score("team"),
      opponentScore: source.manualScore ? source.manualScore[1] : score("opponent"),
      periodCount: 4,
      periodLengthSeconds: 480,
      overtimeLengthSeconds: 240,
      foulReset: "quarter",
      bonusThreshold: 5,
      currentPeriod: source.currentPeriod,
      clockRunning: false,
      clockSecondsLeft: source.clockSecondsLeft,
      clockAnchorAt: null,
      updatedAt: new Date(nowMs).toISOString(),
    });
  }

  return {
    season: { id: demo.season.id, name: demo.season.name },
    teams,
    roster: demo.roster,
    opponents: demo.opponents,
    games,
    events,
  };
}
