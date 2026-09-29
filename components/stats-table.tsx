import Link from "next/link";
import { percentage } from "@/lib/basketball";
import { average } from "@/lib/format";
import type { RosterPlayer, SeasonStatLine } from "@/lib/types";

export type SortKey = "pts" | "reb" | "ast" | "stl" | "blk" | "fg" | "fg3" | "ft";

const COLUMNS: Array<{ key: SortKey; label: string; title: string }> = [
  { key: "pts", label: "PTS", title: "Points per game" },
  { key: "reb", label: "REB", title: "Rebounds per game" },
  { key: "ast", label: "AST", title: "Assists per game" },
  { key: "stl", label: "STL", title: "Steals per game" },
  { key: "blk", label: "BLK", title: "Blocks per game" },
  { key: "fg", label: "FG%", title: "Field goal percentage" },
  { key: "fg3", label: "3P%", title: "Three-point percentage" },
  { key: "ft", label: "FT%", title: "Free throw percentage" },
];

function sortValue(line: SeasonStatLine, key: SortKey) {
  switch (key) {
    case "fg":
      return line.fga ? line.fgm / line.fga : -1;
    case "fg3":
      return line.fg3a ? line.fg3m / line.fg3a : -1;
    case "ft":
      return line.fta ? line.ftm / line.fta : -1;
    default:
      return line.gp ? line[key] / line.gp : 0;
  }
}

/**
 * Season averages for a roster. Players without stats yet are listed at the
 * bottom so the table doubles as the roster early in the season.
 */
export function StatsTable({
  roster,
  stats,
  sort = "pts",
  sortHref,
}: {
  roster: RosterPlayer[];
  stats: SeasonStatLine[];
  sort?: SortKey;
  /** Builds the link for a column header; omit for a static table. */
  sortHref?: (key: SortKey) => string;
}) {
  const byAthlete = new Map(stats.map((line) => [line.athleteId, line]));
  const rows = roster
    .map((player) => ({ player, line: byAthlete.get(player.athleteId) }))
    .sort((a, b) => {
      if (!a.line || !b.line) return a.line ? -1 : b.line ? 1 : (a.player.number ?? 999) - (b.player.number ?? 999);
      return sortValue(b.line, sort) - sortValue(a.line, sort);
    });

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Player</th>
            <th title="Games played">GP</th>
            {COLUMNS.map((column) => (
              <th key={column.key} title={column.title}>
                {sortHref ? (
                  <Link href={sortHref(column.key)} aria-current={sort === column.key}>
                    {column.label}
                    {sort === column.key ? " ▾" : ""}
                  </Link>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, line }) => (
            <tr key={player.athleteId}>
              <td>
                <Link href={`/players/${player.slug}`} className="player-cell">
                  <span className="jersey">{player.number ?? ""}</span>
                  {player.name}
                </Link>
              </td>
              <td>{line?.gp ?? 0}</td>
              {line ? (
                <>
                  <td>
                    <strong>{average(line.pts, line.gp)}</strong>
                  </td>
                  <td>{average(line.reb, line.gp)}</td>
                  <td>{average(line.ast, line.gp)}</td>
                  <td>{average(line.stl, line.gp)}</td>
                  <td>{average(line.blk, line.gp)}</td>
                  <td>{percentage(line.fgm, line.fga)}</td>
                  <td>{percentage(line.fg3m, line.fg3a)}</td>
                  <td>{percentage(line.ftm, line.fta)}</td>
                </>
              ) : (
                <td colSpan={COLUMNS.length} className="muted">
                  –
                </td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={COLUMNS.length + 2} className="muted">
                Roster not posted yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const SORT_KEYS = COLUMNS.map((column) => column.key);
