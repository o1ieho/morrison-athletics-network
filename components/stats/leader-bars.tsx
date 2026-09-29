import Link from "next/link";
import type { RosterPlayer } from "@/lib/types";

export type LeaderRow = { player: RosterPlayer; value: number; display?: string };

/** Top players for one stat as flat horizontal bars. */
export function LeaderBars({ title, rows, unit }: { title: string; rows: LeaderRow[]; unit: string }) {
  const shown = rows.filter((row) => row.value > 0);
  const max = Math.max(...shown.map((row) => row.value), 1);
  return (
    <section className="leader-bars">
      <h3>{title}</h3>
      {shown.length ? (
        <ol>
          {shown.map((row) => (
            <li key={row.player.athleteId}>
              <Link href={`/players/${row.player.slug}`} className="leader-bar-name">
                <span className="jersey">{row.player.number ?? ""}</span>
                {row.player.name}
              </Link>
              <span className="leader-bar-track" aria-hidden="true">
                <span className="leader-bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
              </span>
              <span className="leader-bar-value">
                {row.display ?? row.value}
                <small>{unit}</small>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted small">No stats yet.</p>
      )}
    </section>
  );
}
