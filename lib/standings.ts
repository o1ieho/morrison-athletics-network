// League standings: other schools' records (entered by an admin) plus the
// Broncos' own record (from our final scores), ranked like a league table.

export type StandingInput = { id: string; name: string; wins: number; losses: number; broncos?: boolean };
export type StandingRow = StandingInput & { rank: number; pct: number };

/** Win percentage; a team that hasn't played sits at 0 (and sorts last). */
const pct = (row: Pick<StandingInput, "wins" | "losses">) => (row.wins + row.losses ? row.wins / (row.wins + row.losses) : 0);

/**
 * Sorted by win percentage, then more wins, then name; tied teams share a
 * rank. No "games back": schools in this league play different numbers of
 * games, so it would mislead (a 5-1 team would be "behind" a 2-0 one).
 */
export function rankStandings(rows: StandingInput[]): StandingRow[] {
  const sorted = [...rows].sort((a, b) => pct(b) - pct(a) || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    if (!previous || pct(previous) !== pct(row) || previous.wins !== row.wins || previous.losses !== row.losses) rank = index + 1;
    return { ...row, rank, pct: pct(row) };
  });
}

/** ".750", "1.000", ".000"; the way league tables print it. */
export function formatPct(value: number) {
  return value >= 1 ? "1.000" : value.toFixed(3).replace(/^0/, "");
}
