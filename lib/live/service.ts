import type { EventType, Game, GameEvent, GameStatus, GameSummary, RosterPlayer, Side } from "@/lib/types";

export type LiveSnapshot = {
  game: GameSummary;
  events: GameEvent[];
  roster: RosterPlayer[];
};

export type NewEvent = {
  /** Client-generated so a retried insert can't create a duplicate. */
  id: string;
  side: Side;
  type: EventType;
  athleteId: string | null;
  /** Stamped on the operator's device at tap time, so queued plays keep the right game clock. */
  period: number;
  clockSecondsLeft: number;
  shotX: number | null;
  shotY: number | null;
};

export type ConnectionStatus = "connecting" | "live" | "reconnecting";

export type LiveHandlers = {
  onGame: (game: Game) => void;
  onEvent: (event: GameEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
};

/** Live game reads and operator writes. Implemented by Supabase and by the in-browser demo store. */
export interface LiveService {
  load(gameId: string): Promise<LiveSnapshot | null>;
  subscribe(gameId: string, handlers: LiveHandlers): () => void;
  /** Every game's state changes (for the site-wide live bar). */
  subscribeGames(onGame: (game: Game) => void): () => void;
  /** Server clock minus this device's clock, in ms. */
  measureServerOffset(): Promise<number>;

  addEvent(gameId: string, event: NewEvent): Promise<GameEvent>;
  setVoided(eventId: string, voided: boolean): Promise<GameEvent>;
  startPeriod(gameId: string, period: number): Promise<Game>;
  endPeriod(gameId: string): Promise<Game>;
  clockStart(gameId: string): Promise<Game>;
  clockStop(gameId: string): Promise<Game>;
  clockSet(gameId: string, secondsLeft: number): Promise<Game>;
  setStatus(gameId: string, status: GameStatus): Promise<Game>;
}

/** Thrown for failures where retrying won't help (e.g. not signed in). */
export class PermanentError extends Error {
  name = "PermanentError";
  /** The database error code, when there is one (e.g. "42501" for not allowed). */
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** Codes that mean the operator isn't signed in (or isn't allowed) rather than a bad play. */
export const AUTH_ERROR_CODES = new Set(["42501", "PGRST301"]);
