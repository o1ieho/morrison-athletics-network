import { notFound } from "next/navigation";
import { AnnouncementCard, AthleteCard, GameCard } from "@/components/cards";
import { getTeamAthletes, getTeamBySlug, getTeamGames, getCoaches, getAnnouncements } from "@/lib/supabase-queries";

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const [roster, games, allCoaches, allAnnouncements] = await Promise.all([
    getTeamAthletes(team.id),
    getTeamGames(team.id),
    getCoaches(),
    getAnnouncements()
  ]);
  
  const teamCoaches = allCoaches.filter((coach) => coach.teamIds.includes(team.id));
  const teamAnnouncements = allAnnouncements.filter((announcement) => announcement.teamId === team.id);
  const seasonStatus = team.seasonStatus.replace("_", " ");
  const isFutureOrUnavailable = team.seasonStatus === "upcoming" || team.seasonStatus === "not_offered";

  return (
    <main className="page">
      <section className="section">
        <p className="eyebrow">{team.sport} · {team.level}</p>
        <h1>{team.city} {team.name}</h1>
        <div className="stat-strip">
          <span><strong>{team.record}</strong><small>Record</small></span>
          <span><strong>{roster.length}</strong><small>Roster</small></span>
          <span><strong>{seasonStatus}</strong><small>Season</small></span>
        </div>
      </section>
      {isFutureOrUnavailable && (
        <section className="section alt">
          <article className="card">
            <p className="eyebrow">Season not fully active</p>
            <h2>{team.seasonStatus === "not_offered" ? "This team is not offered this season." : "This team's season has not begun yet."}</h2>
            <p>Roster, schedule, and media details will appear when athletics staff confirm this team's season information.</p>
          </article>
        </section>
      )}
      <section className="section alt">
        <div className="section-head"><h2>Roster</h2></div>
        <div className="grid four">{roster.map((athlete) => <AthleteCard athlete={athlete} key={athlete.id} />)}</div>
      </section>
      <section className="section">
        <div className="grid two">
          <div>
            <h2>Schedule and results</h2>
            <div className="grid">{games.map((game) => <GameCard game={game} key={game.id} />)}</div>
          </div>
          <div>
            <h2>Coaches and updates</h2>
            <div className="grid">
              {teamCoaches.map((coach) => (
                <article className="card" key={coach.id}>
                  <p className="eyebrow">{coach.title}</p>
                  <h3>{coach.name}</h3>
                </article>
              ))}
              {teamAnnouncements.map((announcement) => <AnnouncementCard announcement={announcement} key={announcement.id} />)}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
