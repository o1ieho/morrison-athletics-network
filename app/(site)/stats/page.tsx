import type { Metadata } from "next";
import Link from "next/link";
import { SORT_KEYS, StatsTable, type SortKey } from "@/components/stats-table";
import { getData } from "@/lib/data";
import { teamLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Stats" };

type Props = { searchParams: Promise<{ team?: string; sort?: string }> };

export default async function StatsPage({ searchParams }: Props) {
  const { team: teamSlug, sort: sortParam } = await searchParams;
  const data = await getData();
  const teams = await data.getTeams();
  const team = teams.find((entry) => entry.slug === teamSlug) ?? teams[0];
  const sort = (SORT_KEYS as string[]).includes(sortParam ?? "") ? (sortParam as SortKey) : "pts";
  const [roster, stats] = team ? await Promise.all([data.getRoster(team.id), data.getSeasonStats(team.id)]) : [[], []];

  return (
    <main className="page">
      <div className="container">
        <div className="page-head">
          <p className="eyebrow">Season stats</p>
          <h1>{team ? teamLabel(team) : "Stats"}</h1>
        </div>
        <nav className="filters" aria-label="Team">
          {teams.map((entry) => (
            <Link key={entry.id} className="chip" href={`/stats?team=${entry.slug}&sort=${sort}`} aria-current={entry.id === team?.id}>
              {teamLabel(entry)}
            </Link>
          ))}
        </nav>
        <div className="card">
          <StatsTable roster={roster} stats={stats} sort={sort} sortHref={(key) => `/stats?team=${team?.slug ?? ""}&sort=${key}`} />
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          Per-game averages from final games. Tap a column to sort. GP counts games where a player recorded at least one stat.
        </p>
      </div>
    </main>
  );
}
