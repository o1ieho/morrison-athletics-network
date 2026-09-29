import { GameCard } from "@/components/cards";
import { getGames } from "@/lib/supabase-queries";

export default async function LiveGamesPage() {
  const games = await getGames();
  const live = games.filter((game) => game.status === "live");
  const recent = games.filter((game) => game.status !== "live");

  return (
    <main className="page section">
      <p className="eyebrow">Live Games</p>
      <h1>Scores, gamecast, and box scores</h1>
      <div className="section-head"><h2>Currently live</h2></div>
      <div className="grid three">
        {(live.length ? live : games.slice(0, 1)).map((game) => <GameCard game={game} key={game.id} />)}
      </div>
      <div className="section-head" style={{ marginTop: 40 }}><h2>Recent and upcoming</h2></div>
      <div className="grid three">
        {recent.map((game) => <GameCard game={game} key={game.id} />)}
      </div>
    </main>
  );
}
