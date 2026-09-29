import Link from "next/link";
import { notFound } from "next/navigation";
import { getAthletes, getGameById } from "@/lib/supabase-queries";
import RealtimeSubscriber from "@/components/RealtimeSubscriber";

export default async function BoxScorePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = await getGameById(gameId);
  if (!game) notFound();
  const athletes = await getAthletes();

  return (
    <main className="page section">
      <RealtimeSubscriber gameId={game.id} />
      <p className="eyebrow">Box Score</p>
      <h1>{game.away.team} at {game.home.team}</h1>
      <div className="actions" style={{ marginBottom: "2rem" }}>
        <Link className="button" href={`/live/${game.id}/gamecast`}>Gamecast</Link>
        <Link className="button-secondary" href={`/live/${game.id}`}>Live Game</Link>
      </div>
      <table className="table">
        <thead><tr><th>Player</th><th>Team</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
        <tbody>
          {athletes.slice(0, 8).map((athlete) => (
            <tr key={athlete.id}><td>{athlete.name}</td><td>{athlete.teamId}</td><td>{athlete.points}</td><td>{athlete.rebounds}</td><td>{athlete.assists}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
