"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/lib/live/service";

/**
 * Nothing while the live connection is healthy (the pulsing Live badge says
 * so) or still starting. "Reconnecting…" once it has been down for 5 seconds,
 * then how long it has been without updates after a minute.
 */
export function ConnectionNote({ status }: { status: ConnectionStatus }) {
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
  return (
    <span role="status">
      {elapsed < 5000 ? null : elapsed < 60_000 ? (
        <span className="connection">Reconnecting…</span>
      ) : (
        <span className="connection stale">Last update {Math.floor(elapsed / 60_000)}m ago · retrying</span>
      )}
    </span>
  );
}
