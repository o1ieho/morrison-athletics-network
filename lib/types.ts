export type Sport = {
  id: string;
  slug: string;
  name: string;
  season: "fall" | "winter" | "spring" | "year-round";
  summary: string;
};

export type TeamSeasonStatus = "upcoming" | "active" | "completed" | "not_offered";

export type Team = {
  id: string;
  slug: string;
  name: string;
  city: string;
  sportId: string;
  sport: string;
  level: string;
  gender?: "boys" | "girls" | "coed" | "opponent";
  conference: string;
  record: string;
  seasonStatus: TeamSeasonStatus;
  isOpponent?: boolean;
};

export type Athlete = {
  id: string;
  slug: string;
  number?: number;
  name: string;
  teamId: string;
  position: string;
  grade: string;
  height?: string;
  weight?: string;
  country?: string;
  bio: string;
  points: number;
  rebounds: number;
  assists: number;
  recentGames: Array<{ game: string; pts: number; reb: number; ast: number }>;
  teammates: string[];
};

export type GameStatus = "scheduled" | "live" | "final" | "postponed" | "canceled";

export type Game = {
  id: string;
  slug: string;
  seasonId: string;
  sport: string;
  status: GameStatus;
  displayStatus: string;
  startsAt: string;
  location: string;
  away: { teamId: string; team: string; score: number };
  home: { teamId: string; team: string; score: number };
  leaders: string;
};

export type Announcement = {
  id: string;
  slug: string;
  title: string;
  category: "game-day" | "team-news" | "transportation" | "achievement" | "department";
  author: string;
  summary: string;
  body: string;
  publishedAt: string;
  expiresAt?: string;
  pinned: boolean;
  coverImage?: string;
  teamId?: string;
  athleteId?: string;
};

export type MediaAsset = {
  id: string;
  title: string;
  type: "photo" | "gallery" | "video" | "livestream";
  url: string;
  caption: string;
  featured?: boolean;
  teamId?: string;
  gameId?: string;
  athleteId?: string;
};

export type Coach = {
  id: string;
  name: string;
  title: string;
  teamIds: string[];
};

export type GameEventType =
  | "free_throw_made"
  | "field_goal_made"
  | "three_point_made"
  | "rebound"
  | "assist"
  | "steal"
  | "block"
  | "foul"
  | "turnover";

export type GameEvent = {
  id: string;
  gameId: string;
  teamId: string;
  athleteId?: string;
  type: GameEventType;
  period: number;
  clock: string;
  points: number;
  description: string;
  x?: number;
  y?: number;
};
