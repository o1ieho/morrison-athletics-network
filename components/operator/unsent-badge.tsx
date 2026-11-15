"use client";

import { useEffect, useState } from "react";

/**
 * Shows how many plays for a game are still saved on this device and not yet
 * sent. Plays only send while that game's console is open, so the game list
 * points the operator back to it.
 */
export function UnsentBadge({ gameId }: { gameId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`ssn-queue-${gameId}`);
      const items = raw ? (JSON.parse(raw) as Array<{ cancel?: boolean }>) : [];
      setCount(items.filter((item) => !item.cancel).length);
    } catch {
      setCount(0);
    }
  }, [gameId]);

  if (!count) return null;
  return (
    <span className="op-pill warn">
      {count} unsent {count === 1 ? "play" : "plays"}: open to send
    </span>
  );
}
