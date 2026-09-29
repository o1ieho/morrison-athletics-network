export type GameStatus = "scheduled" | "live" | "final" | "postponed" | "canceled";
export type ScoringMode = "live" | "manual";
export type FoulReset = "quarter" | "half";
export type TeamSeasonStatus = "upcoming" | "active" | "completed" | "not_offered";

/** "team" is the MAT team, "opponent" the other team, "game" is for period markers. */
export type Side = "team" | "opponent" | "game";

export type EventType =
  | "fg2_made"
  | "fg2_miss"
  | "fg3_made"
  | "fg3_miss"
  | "ft_made"
  | "ft_miss"
  | "rebound_off"
  | "rebound_def"
  | "assist"
  | "steal"
  | "block"
  | "turnover"
  | "foul"
  | "timeout"
  | "period_start"
  | "period_end";

export type Season = {
  id: string;
  name: string;
};

export type Team = {
  id: string;
  slug: string;
  name: string;
  gender: "boys" | "girls" | "coed";
  level: "varsity" | "jv";
  conference: string;
  seasonStatus: TeamSeasonStatus;
};

export type Opponent = {
  id: string;
  name: string;
  shortName: string;
};

export type RosterPlayer = {
  athleteId: string;
  slug: string;
  name: string;
  teamId: string;
  number: number | null;
  position: string | null;
  grade: string | null;
  height: string | null;
};

export type Game = {
  id: string;
  seasonId: string;
  teamId: string;
  opponentId: string;
  isHome: boolean;
  startsAt: string;
  location: string;
  status: GameStatus;
  scoringMode: ScoringMode;
  teamScore: number;
  opponentScore: number;
  periodCount: number;
  periodLengthSeconds: number;
  overtimeLengthSeconds: number;
  foulReset: FoulReset;
  bonusThreshold: number;
  currentPeriod: number;
  clockRunning: boolean;
  clockSecondsLeft: number;
  clockAnchorAt: string | null;
  updatedAt: string;
};

/** A game joined with the names needed to display it. */
export type GameSummary = Game & {
  team: Team;
  opponent: Opponent;
};

export type GameEvent = {
  id: string;
  gameId: string;
  side: Side;
  athleteId: string | null;
  type: EventType;
  period: number;
  clockSecondsLeft: number;
  points: number;
  shotX: number | null;
  shotY: number | null;
  createdAt: string;
  voidedAt: string | null;
};

export type StatLine = {
  pts: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
};

export type SeasonStatLine = StatLine & {
  athleteId: string;
  teamId: string;
  gp: number;
};

export type TeamRecord = {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
};

export type AnnouncementCategory = "game-day" | "team-news" | "transportation" | "achievement" | "department";

export type Announcement = {
  id: string;
  slug: string;
  title: string;
  category: AnnouncementCategory;
  summary: string;
  body: string;
  pinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  teamId: string | null;
  athleteId: string | null;
};
