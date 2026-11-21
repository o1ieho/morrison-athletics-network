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

  if (downSince === null) return null;
  const elapsed = now - downSince;
  if (elapsed < 5000) return null;
  if (elapsed < 60_000) return <span className="connection">Reconnecting…</span>;
  return <span className="connection stale">Last update {Math.floor(elapsed / 60_000)}m ago · retrying</span>;
}
