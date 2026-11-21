import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameRow } from "@/components/games";
import { LeaderBars } from "@/components/stats/leader-bars";
import { SORT_KEYS, StatsTable, type SortKey } from "@/components/stats-table";
import { getData } from "@/lib/data";
import { average, teamLabel } from "@/lib/format";
import { recapHeadline } from "@/lib/recap";
import { formatPct, rankStandings } from "@/lib/standings";

/** How many recent finals get a recap headline in the schedule. */
const RECAP_LIMIT = 3;

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
  const [roster, games, stats, records, others] = await Promise.all([
    data.getRoster(team.id),
    data.getGames({ teamId: team.id }),
    data.getSeasonStats(team.id),
    data.getTeamRecords(),
    // Standings are extra: if they can't load, the rest of the page still shows.
    data.getStandings(team.id).catch(() => []),
  ]);
  const record = records.find((entry) => entry.teamId === team.id);
  const standings = others.length
    ? rankStandings([
        { id: "broncos", name: "Morrison Academy Taipei", wins: record?.wins ?? 0, losses: record?.losses ?? 0, broncos: true },
        ...others.map((row) => ({ id: row.opponent.id, name: row.opponent.name, wins: row.wins, losses: row.losses })),
      ])
    : [];
  const finals = games.filter((game) => game.status === "final");
  // One-line recap headlines, for the most recent results only: each needs
  // that game's play-by-play, so the number of reads per view stays small.
  // A game whose plays fail to load just goes without a headline.
  const recent = finals.slice(-RECAP_LIMIT);
  const loaded = await Promise.allSettled(recent.map((game) => data.getGameEvents(game.id)));
  const recaps = new Map(
    recent.flatMap((game, index) => {
      const result = loaded[index];
      return result.status === "fulfilled"
        ? [[game.id, recapHeadline(game, result.value, { team: "Broncos", opponent: game.opponent.shortName })] as const]
        : [];
    }),
  );
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

        {standings.length > 0 && (
          <section aria-labelledby="standings-title">
            <div className="section-head">
              <h2 id="standings-title">{team.conference} standings</h2>
            </div>
            <div className="card">
              <table className="table standings">
                <thead>
                  <tr>
                    <th scope="col" title="Rank">#</th>
                    <th scope="col">School</th>
                    <th scope="col" title="Wins">W</th>
                    <th scope="col" title="Losses">L</th>
                    <th scope="col" title="Win percentage">PCT</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => (
                    <tr key={row.id} className={row.broncos ? "is-us" : undefined} aria-current={row.broncos ? "true" : undefined}>
                      <td>{row.rank}</td>
                      <th scope="row">{row.broncos ? "Broncos" : row.name}</th>
                      <td>{row.wins}</td>
                      <td>{row.losses}</td>
                      <td>{formatPct(row.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              Other schools&apos; records are updated by the athletics office; the Broncos&apos; record comes from our final scores.
            </p>
          </section>
        )}

        {stats.length > 0 && (
          <section className="card card-pad" aria-label="Season leaders">
            <div className="leaders-grid">
              {(
                [
                  ["pts", "Points", "PPG"],
                  ["reb", "Rebounds", "RPG"],
                  ["ast", "Assists", "APG"],
                ] as const
              ).map(([key, title, unit]) => (
                <LeaderBars
                  key={key}
                  title={title}
                  unit={unit}
                  rows={[...stats]
                    .filter((line) => line.gp > 0)
                    .sort((a, b) => b[key] / b.gp - a[key] / a.gp)
                    .slice(0, 5)
                    .flatMap((line) => {
                      const player = roster.find((entry) => entry.athleteId === line.athleteId);
                      return player ? [{ player, value: line[key] / line.gp, display: average(line[key], line.gp) }] : [];
                    })}
                />
              ))}
            </div>
          </section>
        )}

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
                <GameRow key={game.id} game={game} showTeam={false} recap={recaps.get(game.id)} />
              ))}
              {!games.length && <p className="empty">No games posted yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
