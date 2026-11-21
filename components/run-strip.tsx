"use client";

import { useRef } from "react";
import { formatClock, periodLabel } from "@/lib/basketball";
import type { Run } from "@/lib/game-analysis";
import { useBriefly, useFlashKey } from "@/lib/use-flash";
import { ScoreRoll } from "./score-roll";

/**
 * "BRONCOS 8-0 RUN since Q3 4:12": a flat ink band shown while one side has
 * an unanswered run going. It wipes in when a run reaches the threshold during
 * the game, rolls the number as the run grows, and fades out when the other
 * side scores. A run already going when the page loads is just shown.
 */
export function RunStrip({
  run,
  names,
  periodCount,
  className = "",
}: {
  run: Run | null;
  names: { team: string; opponent: string };
  periodCount: number;
  className?: string;
}) {
  const appeared = useFlashKey(Boolean(run));
  const fading = useBriefly(appeared, 200);
  // The run that just ended stays on screen while it fades.
  const last = useRef(run);
  if (run) last.current = run;
  const shown = run ?? (fading ? last.current : null);
  if (!shown) return null;

  const state = !run ? "leaving" : appeared ? "entering" : "";
  return (
    <div key={shown.start.id} className={`run-strip ${shown.side} ${state} ${className}`}>
      <span className="run-strip-text">
        {shown.side === "team" ? names.team : names.opponent} <ScoreRoll value={shown.points} />
        -0 run
      </span>
      <span className="run-strip-since">
        since {periodLabel(shown.start.period, periodCount)} {formatClock(shown.start.clockSecondsLeft)}
      </span>
    </div>
  );
}
