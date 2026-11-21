"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/lib/live/service";

/**
 * Nothing while the live connection is healthy (the pulsing Live badge says
 * so) or still starting. Once it has been down for 5 seconds the page is
 * re-reading the game every 10 seconds instead (see useLiveGame), so it says
 * that; if those reads are failing too, it says how old the score is.
 */
export function ConnectionNote({ status, syncedAt }: { status: ConnectionStatus; syncedAt?: number | null }) {
  const down = status !== "live";
  const [downSince, setDownSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!down) {
      setDownSince(null);
      return;
    }
    const since = Date.now();
    setDownSince(since);
    setNow(since);
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, [down]);

  // The status region is always present, so screen readers announce it when it fills in.
  const elapsed = downSince === null ? 0 : now - downSince;
  // Time since the last good update: the last successful read, or when the connection dropped.
  const stale = downSince === null ? 0 : now - Math.max(syncedAt ?? 0, downSince);
  return (
    <span role="status">
      {elapsed < 5000 ? null : stale < 60_000 ? (
        <span className="connection">Slow connection · updating every 10s</span>
      ) : (
        <span className="connection stale">Last update {Math.floor(stale / 60_000)}m ago · retrying</span>
      )}
    </span>
  );
}
