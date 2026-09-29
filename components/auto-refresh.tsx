"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches the current server-rendered page every `seconds` while it's
 * visible. Used on list pages when a game is live, so scores stay current
 * without a realtime subscription per game.
 */
export function AutoRefresh({ seconds = 20, enabled = true }: { seconds?: number; enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, router, seconds]);

  return null;
}
