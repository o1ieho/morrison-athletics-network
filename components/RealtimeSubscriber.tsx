"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";

export default function RealtimeSubscriber({ gameId }: { gameId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!gameId) return;
    
    const supabase = createBrowserClient();

    // Channel for games table
    const gamesChannel = supabase.channel(`games-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    // Channel for game_events table
    const eventsChannel = supabase.channel(`game_events-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gamesChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [gameId, router]);

  return null;
}
