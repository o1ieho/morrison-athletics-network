"use client";

import type { PostgrestError } from "@supabase/supabase-js";
import { mapEvent, mapGame, mapOpponent, mapRosterRow, mapTeam } from "@/lib/mappers";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { Game } from "@/lib/types";
import { PermanentError, type LiveService } from "./service";

// Postgres / PostgREST codes that mean "don't retry": permission denied, RLS
// violation, check or foreign-key violation, bad input.
const PERMANENT_CODES = new Set(["42501", "PGRST301", "23514", "23503", "22P02", "P0001"]);

function fail(error: PostgrestError | null, what: string): never {
  const message = `${what}: ${error?.message ?? "unknown error"}`;
  if (error && PERMANENT_CODES.has(error.code)) throw new PermanentError(message);
  throw new Error(message);
}

export function createSupabaseLiveService(): LiveService {
  const db = getBrowserClient();

  async function rpc(name: string, args: Record<string, unknown>): Promise<Game> {
    // These functions return one games row, which PostgREST sends as an object.
    const { data, error } = await db.rpc(name, args);
    if (error || !data) fail(error, name.replaceAll("_", " "));
    return mapGame(data as Record<string, unknown>);
  }

  return {
    async load(gameId) {
      const { data: gameRow, error: gameError } = await db
        .from("games")
        .select("*, team:teams!games_team_id_fkey(*), opponent:opponents!games_opponent_id_fkey(*)")
        .eq("id", gameId)
        .maybeSingle();
      if (gameError) fail(gameError, "Loading the game");
      if (!gameRow) return null;

      const [events, roster] = await Promise.all([
        db.from("game_events").select("*").eq("game_id", gameId).order("created_at").limit(2000),
        db
          .from("athlete_seasons")
          .select("*, athletes(id, slug, full_name)")
          .eq("team_id", gameRow.team_id)
          .eq("season_id", gameRow.season_id)
          .order("jersey_number", { ascending: true, nullsFirst: false }),
      ]);
      if (events.error) fail(events.error, "Loading play-by-play");
      if (roster.error) fail(roster.error, "Loading the roster");

      return {
        game: { ...mapGame(gameRow), team: mapTeam(gameRow.team), opponent: mapOpponent(gameRow.opponent) },
        events: events.data.map(mapEvent),
        roster: roster.data.map(mapRosterRow),
      };
    },

    subscribe(gameId, { onGame, onEvent, onStatus }) {
      onStatus("connecting");
      const channel = db
        .channel(`game-${gameId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) =>
          onGame(mapGame(payload.new)),
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` }, (payload) => {
          if (payload.eventType !== "DELETE") onEvent(mapEvent(payload.new));
        })
        .subscribe((status) => {
          onStatus(status === "SUBSCRIBED" ? "live" : "reconnecting");
        });
      return () => {
        void db.removeChannel(channel);
      };
    },

    async measureServerOffset() {
      const sentAt = Date.now();
      const { data, error } = await db.rpc("server_time");
      if (error || !data) return 0;
      const receivedAt = Date.now();
      // Assume the server stamped the time halfway through the round trip.
      return Date.parse(String(data)) - (sentAt + receivedAt) / 2;
    },

    async addEvent(gameId, event) {
      const { data, error } = await db
        .from("game_events")
        .insert({
          id: event.id,
          game_id: gameId,
          side: event.side,
          athlete_id: event.athleteId,
          event_type: event.type,
          period: event.period,
          clock_seconds_left: event.clockSecondsLeft,
          shot_x: event.shotX,
          shot_y: event.shotY,
        })
        .select()
        .single();
      if (error?.code === "23505") {
        // Already saved by an earlier attempt whose response was lost.
        const existing = await db.from("game_events").select("*").eq("id", event.id).single();
        if (existing.error) fail(existing.error, "Saving the play");
        return mapEvent(existing.data);
      }
      if (error || !data) fail(error, "Saving the play");
      return mapEvent(data);
    },

    async setVoided(eventId, voided) {
      const { data, error } = await db
        .from("game_events")
        .update({ voided_at: voided ? new Date().toISOString() : null })
        .eq("id", eventId)
        .select()
        .single();
      if (error || !data) fail(error, voided ? "Undoing the play" : "Restoring the play");
      return mapEvent(data);
    },

    startPeriod: (gameId, period) => rpc("start_period", { p_game_id: gameId, p_period: period }),
    endPeriod: (gameId) => rpc("end_period", { p_game_id: gameId }),
    clockStart: (gameId) => rpc("clock_start", { p_game_id: gameId }),
    clockStop: (gameId) => rpc("clock_stop", { p_game_id: gameId }),
    clockSet: (gameId, secondsLeft) => rpc("clock_set", { p_game_id: gameId, p_seconds_left: secondsLeft }),
    setStatus: (gameId, status) => rpc("set_game_status", { p_game_id: gameId, p_status: status }),
  };
}
