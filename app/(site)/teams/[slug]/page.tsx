import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameRow } from "@/components/games";
import { SORT_KEYS, StatsTable, type SortKey } from "@/components/stats-table";
import { getData } from "@/lib/data";
import { teamLabel } from "@/lib/format";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> };

async function findTeam(slug: string) {
  const teams = await (await getData()).getTeams();
  return teams.find((team) => team.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = await findTeam((await params).slug);
  return { title: team ? teamLabel(team) : "Team" };
}

export default async function TeamPage({ params, searchParams }: Props) {
  const team = await findTeam((await params).slug);
  if (!team) notFound();
  const { sort: sortParam } = await searchParams;
  const sort = (SORT_KEYS as string[]).includes(sortParam ?? "") ? (sortParam as SortKey) : "pts";
  const data = await getData();
  const [roster, games, stats, records] = await Promise.all([
    data.getRoster(team.id),
    data.getGames({ teamId: team.id }),
    data.getSeasonStats(team.id),
    data.getTeamRecords(),
  ]);
  const record = records.find((entry) => entry.teamId === team.id);
  const finals = games.filter((game) => game.status === "final");
  const last5 = finals.slice(-5).map((game) => (game.teamScore > game.opponentScore ? "W" : game.teamScore < game.opponentScore ? "L" : "T"));

  return (
    <main className="page">
      <div className="container stack-lg">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <p className="eyebrow">{team.conference} · Broncos basketball</p>
          <h1>{teamLabel(team)}</h1>
          <div className="stat-tiles" style={{ maxWidth: 520, marginTop: 10 }}>
            <div className="stat-tile">
              <strong className="tabular">
                {record?.wins ?? 0}–{record?.losses ?? 0}
              </strong>
              <span>Record</span>
            </div>
            <div className="stat-tile">
              <strong>{roster.length}</strong>
              <span>Players</span>
            </div>
            <div className="stat-tile">
              <strong>{last5.length ? last5.join(" ") : "–"}</strong>
              <span>Last {last5.length || 5}</span>
            </div>
          </div>
        </div>

        <div className="split">
          <section id="stats">
            <div className="section-head">
              <h2>Roster & season stats</h2>
            </div>
            <div className="card">
              <StatsTable roster={roster} stats={stats} sort={sort} sortHref={(key) => `/teams/${team.slug}?sort=${key}#stats`} />
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              Per-game averages from final games. Tap a column to sort.
            </p>
          </section>
          <section>
            <div className="section-head">
              <h2>Schedule</h2>
            </div>
            <div className="card game-list">
              {games.map((game) => (
                <GameRow key={game.id} game={game} showTeam={false} />
              ))}
              {!games.length && <p className="empty">No games posted yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
