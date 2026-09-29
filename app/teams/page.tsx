import { TeamCard } from "@/components/cards";
import { getSports, getTeams } from "@/lib/supabase-queries";

export default async function TeamsPage() {
  const [sports, teams] = await Promise.all([getSports(), getTeams()]);
  const publicTeams = teams.filter((team) => !team.isOpponent);

  return (
    <main className="page section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Teams</p>
          <h1>Broncos teams by sport</h1>
          <p className="meta">One directory for every Morrison Academy Taipei Athletics team, whether the season is active, upcoming, completed, or not offered this year.</p>
        </div>
      </div>
      {sports.map((sport) => {
        const sportTeams = publicTeams.filter((team) => team.sportId === sport.id);
        if (!sportTeams.length) return null;
        return (
          <section className="section" style={{ paddingLeft: 0, paddingRight: 0 }} key={sport.id}>
            <div className="section-head">
              <div>
                <p className="eyebrow">{sport.season} season</p>
                <h2>{sport.name}</h2>
              </div>
            </div>
            <div className="grid three">
              {sportTeams.map((team) => <TeamCard team={team} key={team.id} />)}
            </div>
          </section>
        );
      })}
    </main>
  );
}
