import { notFound } from "next/navigation";
import { getAthleteBySlug, getAthleteStats, getMediaAssets, getTeams } from "@/lib/supabase-queries";

export default async function AthletePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const athlete = await getAthleteBySlug(slug);
  if (!athlete) notFound();
  
  const [teams, mediaAssets, stats] = await Promise.all([
    getTeams(),
    getMediaAssets(),
    getAthleteStats(athlete.id)
  ]);
  
  const team = teams.find((entry) => entry.id === athlete.teamId);

  return (
    <main className="page">
      <section className="section">
        <p className="eyebrow">#{athlete.number} · {athlete.position} · Grade {athlete.grade}</p>
        <h1>{athlete.name}</h1>
        <p>{athlete.bio}</p>
        <p className="meta">{team ? `${team.city} ${team.name}` : athlete.teamId} · {athlete.height} · {athlete.weight}</p>
      </section>
      <section className="section alt">
        <div className="grid two">
          <article className="card">
            <h2>Season stats</h2>
            <div className="stat-strip">
              <span><strong>{stats.points}</strong><small>PTS</small></span>
              <span><strong>{stats.rebounds}</strong><small>REB</small></span>
              <span><strong>{stats.assists}</strong><small>AST</small></span>
            </div>
          </article>
          <article className="card">
            <h2>Recent performances</h2>
            <table className="table">
              <tbody>
                {athlete.recentGames.map((game) => (
                  <tr key={game.game}><td>{game.game}</td><td>{game.pts} PTS</td><td>{game.reb} REB</td><td>{game.ast} AST</td></tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      </section>
      <section className="section">
        <h2>Related highlights</h2>
        <div className="grid three">
          {mediaAssets.map((asset) => (
            <article className="feature-card" key={asset.id}>
              <p className="eyebrow">{asset.type}</p>
              <h3>{asset.title}</h3>
              <p>{asset.caption}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
