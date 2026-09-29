"use client";

// Demo-mode live service: the game state lives in this browser's localStorage
// and changes are broadcast to other tabs, so an operator tab and a viewer tab
// on the same computer behave like the real realtime setup. It mirrors the
// database rules (scores derived from events, server-stamped clock) closely
// enough for practice and demos. Nothing leaves the browser.

import { clockSecondsLeft, periodLengthSeconds, pointsFor } from "@/lib/basketball";
import type { DemoDataset } from "@/lib/demo/dataset";
import type { Game, GameEvent } from "@/lib/types";
import { PermanentError, type LiveHandlers, type LiveService } from "./service";

const STORAGE_KEY = "ssn-demo-v1";
const CHANNEL = "ssn-demo";

type Message = { kind: "game"; game: Game } | { kind: "event"; event: GameEvent } | { kind: "reset" };

let datasetPromise: Promise<DemoDataset> | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<(message: Message) => void>();

function getChannel() {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (message) => listeners.forEach((listener) => listener(message.data as Message));
  }
  return channel;
}

function broadcast(message: Message) {
  // Deliver to this tab's subscribers too; BroadcastChannel skips the sender.
  listeners.forEach((listener) => listener(message));
  getChannel()?.postMessage(message);
}

function read(): DemoDataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoDataset) : null;
  } catch {
    return null;
  }
}

function write(dataset: DemoDataset) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
  } catch {
    // Storage full or blocked: the demo keeps working for this page view.
  }
}

async function dataset(): Promise<DemoDataset> {
  const stored = read();
  if (stored) return stored;
  datasetPromise ??= fetch("/api/demo", { cache: "no-store" })
    .then((response) => response.json() as Promise<DemoDataset>)
    .then((fresh) => {
      write(fresh);
      return fresh;
    });
  return datasetPromise;
}

/** Restores the demo data to its starting state in every open tab. */
export async function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  datasetPromise = null;
  await dataset();
  broadcast({ kind: "reset" });
}

async function mutateGame(gameId: string, change: (game: Game, data: DemoDataset) => void): Promise<Game> {
  const data = await dataset();
  const game = data.games.find((entry) => entry.id === gameId);
  if (!game) throw new PermanentError("Game not found");
  change(game, data);
  game.updatedAt = new Date().toISOString();
  write(data);
  broadcast({ kind: "game", game });
  return { ...game };
}

function recomputeScore(game: Game, events: GameEvent[]) {
  if (game.scoringMode !== "live") return;
  const mine = events.filter((event) => event.gameId === game.id && !event.voidedAt);
  game.teamScore = mine.filter((event) => event.side === "team").reduce((sum, event) => sum + event.points, 0);
  game.opponentScore = mine.filter((event) => event.side === "opponent").reduce((sum, event) => sum + event.points, 0);
}

function stopClock(game: Game) {
  game.clockSecondsLeft = clockSecondsLeft(game, Date.now());
  game.clockRunning = false;
  game.clockAnchorAt = null;
}

function marker(game: Game, type: "period_start" | "period_end"): GameEvent {
  return {
    id: crypto.randomUUID(),
    gameId: game.id,
    side: "game",
    athleteId: null,
    type,
    period: game.currentPeriod,
    clockSecondsLeft: game.clockSecondsLeft,
    points: 0,
    shotX: null,
    shotY: null,
    createdAt: new Date().toISOString(),
    voidedAt: null,
  };
}

export function createLocalLiveService(): LiveService {
  return {
    async load(gameId) {
      const data = await dataset();
      const game = data.games.find((entry) => entry.id === gameId);
      if (!game) return null;
      return {
        game: {
          ...game,
          team: data.teams.find((team) => team.id === game.teamId)!,
          opponent: data.opponents.find((opponent) => opponent.id === game.opponentId)!,
        },
        events: data.events.filter((event) => event.gameId === gameId),
        roster: data.roster
          .filter((player) => player.teamId === game.teamId)
          .sort((a, b) => (a.number ?? 999) - (b.number ?? 999)),
      };
    },

    subscribe(gameId, { onGame, onEvent, onStatus }: LiveHandlers) {
      getChannel();
      const listener = (message: Message) => {
        if (message.kind === "game" && message.game.id === gameId) onGame(message.game);
        if (message.kind === "event" && message.event.gameId === gameId) onEvent(message.event);
        if (message.kind === "reset") window.location.reload();
      };
      listeners.add(listener);
      onStatus("live");
      return () => {
        listeners.delete(listener);
      };
    },

    subscribeGames(onGame) {
      getChannel();
      const listener = (message: Message) => {
        if (message.kind === "game") onGame(message.game);
      };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async measureServerOffset() {
      return 0;
    },

    async addEvent(gameId, input) {
      const data = await dataset();
      const existing = data.events.find((event) => event.id === input.id);
      if (existing) return existing;
      const event: GameEvent = {
        id: input.id,
        gameId,
        side: input.side,
        athleteId: input.athleteId,
        type: input.type,
        period: input.period,
        clockSecondsLeft: input.clockSecondsLeft,
        points: pointsFor(input.type),
        shotX: input.shotX,
        shotY: input.shotY,
        createdAt: new Date().toISOString(),
        voidedAt: null,
      };
      data.events.push(event);
      write(data);
      broadcast({ kind: "event", event });
      await mutateGame(gameId, (game, latest) => recomputeScore(game, latest.events));
      return event;
    },

    async setVoided(eventId, voided) {
      const data = await dataset();
      const event = data.events.find((entry) => entry.id === eventId);
      if (!event) throw new PermanentError("Play not found");
      event.voidedAt = voided ? new Date().toISOString() : null;
      write(data);
      broadcast({ kind: "event", event: { ...event } });
      await mutateGame(event.gameId, (game, latest) => recomputeScore(game, latest.events));
      return { ...event };
    },

    async startPeriod(gameId, period) {
      let started: GameEvent | null = null;
      const game = await mutateGame(gameId, (game, data) => {
        game.currentPeriod = period;
        game.status = "live";
        game.clockRunning = false;
        game.clockAnchorAt = null;
        game.clockSecondsLeft = periodLengthSeconds(game, period);
        started = marker(game, "period_start");
        data.events.push(started);
      });
      if (started) broadcast({ kind: "event", event: started });
      return game;
    },

    async endPeriod(gameId) {
      let ended: GameEvent | null = null;
      const game = await mutateGame(gameId, (game, data) => {
        game.clockRunning = false;
        game.clockAnchorAt = null;
        game.clockSecondsLeft = 0;
        ended = marker(game, "period_end");
        data.events.push(ended);
      });
      if (ended) broadcast({ kind: "event", event: ended });
      return game;
    },

    clockStart: (gameId) =>
      mutateGame(gameId, (game) => {
        if (game.clockRunning || game.clockSecondsLeft <= 0) return;
        game.clockRunning = true;
        game.clockAnchorAt = new Date().toISOString();
        game.status = "live";
      }),

    clockStop: (gameId) =>
      mutateGame(gameId, (game) => {
        if (game.clockRunning) stopClock(game);
      }),

    clockSet: (gameId, secondsLeft) =>
      mutateGame(gameId, (game) => {
        game.clockSecondsLeft = Math.max(0, secondsLeft);
        game.clockAnchorAt = game.clockRunning ? new Date().toISOString() : null;
      }),

    setStatus: (gameId, status) =>
      mutateGame(gameId, (game) => {
        if (status !== "live") stopClock(game);
        game.status = status;
      }),
  };
}
