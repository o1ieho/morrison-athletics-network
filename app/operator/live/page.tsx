import Link from "next/link";
import { Radio } from "lucide-react";
import { getGames } from "@/lib/supabase-queries";

export default async function OperatorLivePage() {
  const games = await getGames();
  return (
    <main className="operator-shell">
      <section className="operator-page">
        <p className="eyebrow">Live Stat Operator</p>
        <h1>Select a game</h1>
        <div className="grid three">
          {games.map((game) => (
            <article className="operator-card" key={game.id}>
              <p className="eyebrow">{game.displayStatus}</p>
              <h3>{game.away.team} at {game.home.team}</h3>
              <p>{game.location}</p>
              <Link className="button" href={`/operator/live/${game.id}`}>
                <Radio size={16} /> Open Operator
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
