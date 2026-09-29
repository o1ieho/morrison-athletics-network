import { readFileSync } from "fs";
import path from "path";
import type { Announcement, Athlete, Coach, Game, GameEvent, MediaAsset, Sport, Team } from "@/lib/types";
import { formatTeamName, slugify } from "@/lib/utils";

type LegacyTeam = { id: string; name: string; city: string; conference: string };
type LegacyPlayer = Omit<Athlete, "slug" | "grade" | "bio">;
type LegacyGame = {
  id: string;
  league: string;
  status: string;
  live: boolean;
  away: { teamId: string; team: string; score: number };
  home: { teamId: string; team: string; score: number };
  leaders: string;
};
type LegacyArticle = {
  id: string;
  title: string;
  author: string;
  time: string;
  summary: string;
  body: string;
  playerId?: string;
  teamId?: string;
};

const legacyDir = path.join(process.cwd(), "data", "legacy");

function readLegacyJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(legacyDir, fileName), "utf8")) as T;
}

const legacyTeams = readLegacyJson<LegacyTeam[]>("teams.json");
const legacyPlayers = readLegacyJson<LegacyPlayer[]>("players.json");
const legacyGames = readLegacyJson<LegacyGame[]>("games.json");
const legacyArticles = readLegacyJson<LegacyArticle[]>("articles.json");
const legacyGamecast = readLegacyJson<Record<string, string[]>>("gamecast.json");

export const season = {
  id: "2026-27",
  name: "2026-27 Morrison Academy Taipei Athletics",
  startsAt: "2026-08-01",
  endsAt: "2027-06-15",
};

export const sports: Sport[] = [
  { id: "basketball", slug: "basketball", name: "Basketball", season: "winter", summary: "Winter Broncos basketball schedules, rosters, live games, and box-score coverage." },
  { id: "soccer", slug: "soccer", name: "Soccer", season: "fall", summary: "Boys fall soccer and girls spring soccer team pages, schedules, and results." },
  { id: "volleyball", slug: "volleyball", name: "Volleyball", season: "fall", summary: "Girls fall volleyball and boys spring volleyball match schedules, rosters, and updates." },
];

const basketballTeamId = "MAT-BBB-V";
const teamIdAliases: Record<string, string> = { MAT: basketballTeamId };

function normalizeTeamId(teamId: string) {
  return teamIdAliases[teamId] || teamId;
}

const morrisonTeams: Team[] = [
  { id: basketballTeamId, slug: "varsity-boys-basketball", name: "Broncos", city: "Morrison", sportId: "basketball", sport: "Basketball", level: "Varsity", gender: "boys", conference: "TISSA", record: "2-1", seasonStatus: "active" },
  { id: "MAT-GBB-V", slug: "varsity-girls-basketball", name: "Broncos", city: "Morrison", sportId: "basketball", sport: "Basketball", level: "Varsity", gender: "girls", conference: "TISSA", record: "0-0", seasonStatus: "active" },
  { id: "MAT-BSOC-V", slug: "varsity-boys-soccer", name: "Broncos", city: "Morrison", sportId: "soccer", sport: "Soccer", level: "Varsity", gender: "boys", conference: "TISSA", record: "0-0", seasonStatus: "completed" },
  { id: "MAT-GSOC-V", slug: "varsity-girls-soccer", name: "Broncos", city: "Morrison", sportId: "soccer", sport: "Soccer", level: "Varsity", gender: "girls", conference: "TISSA", record: "0-0", seasonStatus: "upcoming" },
  { id: "MAT-GVB-V", slug: "varsity-girls-volleyball", name: "Broncos", city: "Morrison", sportId: "volleyball", sport: "Volleyball", level: "Varsity", gender: "girls", conference: "TISSA", record: "0-0", seasonStatus: "completed" },
  { id: "MAT-BVB-V", slug: "varsity-boys-volleyball", name: "Broncos", city: "Morrison", sportId: "volleyball", sport: "Volleyball", level: "Varsity", gender: "boys", conference: "TISSA", record: "0-0", seasonStatus: "upcoming" },
];

const opponentTeams: Team[] = legacyTeams
  .filter((team) => team.id !== "MAT")
  .map((team) => ({
    ...team,
    slug: slugify(formatTeamName(team)),
    sportId: "basketball",
    sport: "Basketball",
    level: "Opponent",
    gender: "opponent" as const,
    record: "0-0",
    seasonStatus: "active" as const,
    isOpponent: true,
  }));

export const teams: Team[] = [...morrisonTeams, ...opponentTeams];

export const athletes: Athlete[] = legacyPlayers.map((player, index) => ({
  ...player,
  teamId: normalizeTeamId(player.teamId),
  slug: slugify(player.name),
  grade: index < 4 ? "12" : index < 8 ? "11" : "10",
  bio: `${player.name} is part of the Broncos varsity basketball roster and contributes to the team's pace, spacing, and game-day identity.`,
}));

const gameDates = ["2026-12-04T10:00:00+08:00", "2026-12-08T17:30:00+08:00", "2026-12-11T18:00:00+08:00"];

export const games: Game[] = legacyGames.map((game, index) => ({
  id: game.id,
  slug: game.id,
  seasonId: season.id,
  sport: "Basketball",
  status: game.live ? "live" : game.status.toLowerCase().includes("final") ? "final" : "scheduled",
  displayStatus: game.status,
  startsAt: gameDates[index] || gameDates[0],
  location: game.home.teamId === "MAT" ? "Morrison Academy Gym" : `${game.home.team} Gym`,
  away: { ...game.away, teamId: normalizeTeamId(game.away.teamId) },
  home: { ...game.home, teamId: normalizeTeamId(game.home.teamId) },
  leaders: game.leaders,
}));

export const announcements: Announcement[] = legacyArticles.map((article, index) => ({
  id: article.id,
  slug: slugify(article.title),
  title: article.title,
  category: index === 0 ? "achievement" : "team-news",
  author: article.author,
  summary: article.summary,
  body: article.body,
  publishedAt: new Date(Date.now() - index * 3600 * 1000).toISOString(),
  pinned: index === 0,
  coverImage: "/media/basketball-court.svg",
  teamId: article.teamId ? normalizeTeamId(article.teamId) : undefined,
  athleteId: article.playerId,
}));

export const coaches: Coach[] = [
  {
    id: "coach-1",
    name: "Morrison Academy Taipei Athletics Staff",
    title: "Varsity Basketball Staff",
    teamIds: [basketballTeamId],
  },
];

export const mediaAssets: MediaAsset[] = [
  {
    id: "media-1",
    title: "Broncos Basketball Highlights",
    type: "video",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    caption: "Featured highlight slot for the Morrison Academy Taipei Athletics media hub.",
    featured: true,
    teamId: basketballTeamId,
  },
  {
    id: "media-2",
    title: "Game Night Gallery",
    type: "gallery",
    url: "/media/basketball-court.svg",
    caption: "Photo-gallery placeholder for basketball game coverage.",
    teamId: basketballTeamId,
  },
];

export const gameEvents: GameEvent[] = [
  {
    id: "event-1",
    gameId: "g1",
    teamId: basketballTeamId,
    athleteId: "p1",
    type: "field_goal_made",
    period: 1,
    clock: "12:00",
    points: 2,
    description: "Austin Dam opens the game with a strong finish.",
    x: 0.54,
    y: 0.21,
  },
  {
    id: "event-2",
    gameId: "g1",
    teamId: basketballTeamId,
    athleteId: "p2",
    type: "three_point_made",
    period: 1,
    clock: "10:42",
    points: 3,
    description: "Kyan Cheng hits from the wing.",
    x: 0.74,
    y: 0.33,
  },
  ...Object.entries(legacyGamecast).flatMap(([gameId, plays]) =>
    plays.slice(0, 3).map((play, index) => ({
      id: `${gameId}-legacy-${index}`,
      gameId,
      teamId: basketballTeamId,
      type: "assist" as const,
      period: 1,
      clock: "08:00",
      points: 0,
      description: play,
    })),
  ),
];

export function getTeamBySlug(slug: string) {
  return teams.find((team) => team.slug === slug);
}

export function getAthleteBySlug(slug: string) {
  return athletes.find((athlete) => athlete.slug === slug);
}

export function getAnnouncementBySlug(slug: string) {
  return announcements.find((announcement) => announcement.slug === slug);
}

export function getGameById(gameId: string) {
  return games.find((game) => game.id === gameId);
}

export function getTeamAthletes(teamId: string) {
  return athletes.filter((athlete) => athlete.teamId === teamId);
}

export function getTeamGames(teamId: string) {
  return games.filter((game) => game.home.teamId === teamId || game.away.teamId === teamId);
}

export function getGameEvents(gameId: string) {
  return gameEvents.filter((event) => event.gameId === gameId);
}

export function getAthleteStats(athleteId: string) {
  const source = athletes.find((athlete) => athlete.id === athleteId);
  return {
    points: source?.points || 0,
    rebounds: source?.rebounds || 0,
    assists: source?.assists || 0,
  };
}
