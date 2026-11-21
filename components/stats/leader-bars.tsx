"use client";

import Link from "next/link";
import type { RosterPlayer } from "@/lib/types";
import { useFlash, useFlashKey } from "@/lib/use-flash";

export type LeaderRow = { player: RosterPlayer; value: number; display?: string };

/**
 * Top players for one stat as flat horizontal bars. During a live game the
 * bars ease to their new length, a value that goes up holds yellow for a
 * moment, and when someone takes over first place their row flashes. The
 * order itself swaps instantly. Nothing moves on page load.
 */
export function LeaderBars({ title, rows, unit }: { title: string; rows: LeaderRow[]; unit: string }) {
  const shown = rows.filter((row) => row.value > 0);
  const max = Math.max(...shown.map((row) => row.value), 1);
  const newLeader = useFlashKey(shown[0]?.player.athleteId);
  return (
    <section className="leader-bars">
      <h3>{title}</h3>
      <ol>
        {shown.map((row, index) => (
          <LeaderBarRow key={row.player.athleteId} row={row} share={row.value / max} unit={unit} rankUp={index === 0 && newLeader > 0} />
        ))}
        {/* No stats yet: empty tracks keep the panel's shape. */}
        {!shown.length &&
          [0, 1, 2].map((index) => (
            <li key={index} className="leader-bar-empty" aria-hidden={index > 0 ? true : undefined}>
              <span className="leader-bar-name">{index === 0 && <span className="visually-hidden">No stats yet</span>}</span>
              <span className="leader-bar-track" />
              <span className="leader-bar-value">–</span>
            </li>
          ))}
      </ol>
    </section>
  );
}

function LeaderBarRow({ row, share, unit, rankUp }: { row: LeaderRow; share: number; unit: string; rankUp: boolean }) {
  const { key, delta } = useFlash(row.value);
  return (
    <li className={rankUp ? "rank-up" : undefined}>
      <Link href={`/players/${row.player.slug}`} className="leader-bar-name">
        <span className="jersey">{row.player.number ?? ""}</span>
        {row.player.name}
      </Link>
      <span className="leader-bar-track" aria-hidden="true">
        <span className="leader-bar-fill" style={{ transform: `scaleX(${share})` }} />
      </span>
      <span key={key} className={`leader-bar-value ${key && delta > 0 ? "flash" : ""}`}>
        {row.display ?? row.value}
        <small>{unit}</small>
      </span>
    </li>
  );
}
