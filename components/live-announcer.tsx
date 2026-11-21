"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatClock } from "@/lib/basketball";
import { currentRun } from "@/lib/game-analysis";
import { periodName, runWithArticle } from "@/lib/recap";
import type { GameEvent, GameSummary } from "@/lib/types";

/** Screen readers hear at most one update this often, carrying only the latest state. */
const MIN_GAP_MS = 10_000;

/**
 * A visually hidden live region that reads out score changes, run starts, the
 * end of each period and the final score, so screen-reader users can follow a
 * game without the clock or every play being read out. Nothing is announced
 * for what's already on screen when the page loads.
 */
export function LiveAnnouncer({ game, events, clock }: { game: GameSummary; events: GameEvent[]; clock: number }) {
  const [message, setMessage] = useState("");
  const pending = useRef<{ score?: string; run?: string; period?: string; final?: string }>({});
  const lastSent = useRef(0);
  const timer = useRef<number | null>(null);
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const team = "Broncos";
  const opponent = game.opponent.shortName;
  const run = useMemo(() => currentRun(events), [events]);
  const lastPeriodEnd = useMemo(() => [...events].reverse().find((event) => event.type === "period_end" && !event.voidedAt), [events]);

  // What was on screen at load, so only later changes are announced.
  const seen = useRef<{ score: string; run: string | null; periodEnd: string | null; status: string } | null>(null);
  seen.current ??= {
    score: `${game.teamScore}-${game.opponentScore}`,
    run: run?.start.id ?? null,
    periodEnd: lastPeriodEnd?.id ?? null,
    status: game.status,
  };

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const before = seen.current!;
    const score = `${game.teamScore}-${game.opponentScore}`;
    const scoreLine = `${team} ${game.teamScore}, ${opponent} ${game.opponentScore}`;
    let changed = false;

    if (score !== before.score) {
      before.score = score;
      if (game.status === "live") {
        pending.current.score = `${scoreLine}, ${periodName(game.currentPeriod, game.periodCount)}, ${formatClock(clockRef.current)} left.`;
        changed = true;
      }
    }
    const runId = run?.start.id ?? null;
    if (runId !== before.run) {
      before.run = runId;
      if (run) {
        pending.current.run = `${run.side === "team" ? team : opponent} on ${runWithArticle(run.points)} run.`;
        changed = true;
      }
    }
    if ((lastPeriodEnd?.id ?? null) !== before.periodEnd) {
      before.periodEnd = lastPeriodEnd?.id ?? null;
      if (lastPeriodEnd && game.status === "live") {
        pending.current.period = `End of the ${periodName(lastPeriodEnd.period, game.periodCount)}. ${scoreLine}.`;
        changed = true;
      }
    }
    if (game.status !== before.status) {
      before.status = game.status;
      if (game.status === "final") {
        pending.current = { final: `Final: ${scoreLine}.` };
        changed = true;
      }
    }
    if (!changed) return;

    const flush = () => {
      timer.current = null;
      const { final, period, run: runText, score: scoreText } = pending.current;
      pending.current = {};
      const text = final ?? [period ?? scoreText, runText].filter(Boolean).join(" ");
      if (!text) return;
      lastSent.current = Date.now();
      setMessage(text);
    };
    const wait = lastSent.current + MIN_GAP_MS - Date.now();
    if (wait <= 0) flush();
    else if (timer.current === null) timer.current = window.setTimeout(flush, wait);
  }, [game.teamScore, game.opponentScore, game.status, game.currentPeriod, game.periodCount, run, lastPeriodEnd, opponent]);

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
