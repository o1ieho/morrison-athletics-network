import { ScheduleRow } from "@/components/cards";
import { getGames, getSports, getTeams } from "@/lib/supabase-queries";

export default async function SchedulePage() {
  const [games, teams, sports] = await Promise.all([getGames(), getTeams(), getSports()]);
  const postedSports = Array.from(new Set(games.map((game) => game.sport)));

  return (
    <main className="page section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1>All-sport schedule</h1>
          <p className="meta">One calendar for Morrison Academy Taipei Athletics games, meets, matches, postponements, and final results.</p>
        </div>
        <div className="filters">
          {postedSports.length ? postedSports.map((sport) => <span className="status" key={sport}>{sport}</span>) : sports.slice(0, 3).map((sport) => <span className="status" key={sport.id}>{sport.name}</span>)}
          <span className="status">2026-27</span>
          <span className="status">{teams.filter((team) => !team.isOpponent).length} teams</span>
        </div>
      </div>
      <table className="table">
        <thead><tr><th>Date</th><th>Matchup</th><th>Location</th><th>Status</th><th>Link</th></tr></thead>
        <tbody>{games.map((game) => <ScheduleRow game={game} key={game.id} />)}</tbody>
      </table>
    </main>
  );
}
