import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/stats/sparkline";
import { percentage } from "@/lib/basketball";
import { getData } from "@/lib/data";
import { average, formatShortDay, resultLetter, teamLabel } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

async function findPlayer(slug: string) {
  const roster = await (await getData()).getRoster();
  return roster.find((player) => player.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const player = await findPlayer((await params).slug);
  return { title: player?.name ?? "Player" };
}

export default async function PlayerPage({ params }: Props) {
  const player = await findPlayer((await params).slug);
  if (!player) notFound();
  const data = await getData();
  const [teams, stats, log, games] = await Promise.all([
    data.getTeams(),
    data.getSeasonStats(player.teamId),
    data.getPlayerGameLog(player.athleteId),
    data.getGames({ teamId: player.teamId }),
  ]);
  const team = teams.find((entry) => entry.id === player.teamId);
  const season = stats.find((line) => line.athleteId === player.athleteId);
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const rows = log
    .map((entry) => ({ ...entry, game: gamesById.get(entry.gameId) }))
    .filter((entry) => entry.game)
    .sort((a, b) => b.game!.startsAt.localeCompare(a.game!.startsAt));

  const tiles = season
    ? [
        ["PPG", average(season.pts, season.gp)],
        ["RPG", average(season.reb, season.gp)],
        ["APG", average(season.ast, season.gp)],
        ["FG%", percentage(season.fgm, season.fga)],
        ["3P%", percentage(season.fg3m, season.fg3a)],
        ["FT%", percentage(season.ftm, season.fta)],
      ]
    : [];

  return (
    <main className="page">
      <div className="container stack-lg">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <p className="eyebrow">
            {team ? <Link href={`/teams/${team.slug}`}>{teamLabel(team)}</Link> : null}
          </p>
          <h1>
            {player.number !== null && <span className="muted">#{player.number} </span>}
            {player.name}
          </h1>
          <p className="muted">{[player.position, player.height, player.grade ? `Grade ${player.grade}` : null].filter(Boolean).join(" · ")}</p>
        </div>

        <section>
          <div className="section-head">
            <h2>Season</h2>
            {season && <span className="muted small">{season.gp} games</span>}
          </div>
          {tiles.length ? (
            <div className="stat-tiles">
              {tiles.map(([label, value]) => (
                <div key={label} className="stat-tile">
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="card empty">No stats yet this season.</div>
          )}
          {(() => {
            const finals = rows.filter(({ game }) => game!.status === "final").reverse();
            return finals.length >= 2 ? (
              <div className="card card-pad" style={{ marginTop: 16 }}>
                <Sparkline
                  values={finals.map(({ line }) => line.pts)}
                  labels={finals.map(({ game }) => `${formatShortDay(game!.startsAt)} ${game!.isHome ? "vs" : "at"} ${game!.opponent.shortName}`)}
                />
              </div>
            ) : null;
          })()}
        </section>

        <section>
          <div className="section-head">
            <h2>Game log</h2>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Result</th>
                    <th>PTS</th>
                    <th>REB</th>
                    <th>AST</th>
                    <th>FG</th>
                    <th>3PT</th>
                    <th>FT</th>
                    <th>STL</th>
                    <th>BLK</th>
                    <th>TO</th>
                    <th>PF</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ game, line }) => {
                    const result = resultLetter(game!);
                    return (
                      <tr key={game!.id}>
                        <td>
                          <Link href={`/games/${game!.id}`}>
                            {formatShortDay(game!.startsAt)} {game!.isHome ? "vs" : "at"} {game!.opponent.shortName}
                          </Link>
                        </td>
                        <td>
                          {result ? <span className={`result ${result}`}>{result}</span> : <span className="badge live">Live</span>} {game!.teamScore}–{game!.opponentScore}
                        </td>
                        <td>
                          <strong>{line.pts}</strong>
                        </td>
                        <td>{line.reb}</td>
                        <td>{line.ast}</td>
                        <td>
                          {line.fgm}-{line.fga}
                        </td>
                        <td>
                          {line.fg3m}-{line.fg3a}
                        </td>
                        <td>
                          {line.ftm}-{line.fta}
                        </td>
                        <td>{line.stl}</td>
                        <td>{line.blk}</td>
                        <td>{line.tov}</td>
                        <td>{line.pf}</td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={12} className="muted">
                        No games yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
