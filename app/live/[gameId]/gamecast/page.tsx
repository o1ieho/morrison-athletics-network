import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameById, getGameEvents } from "@/lib/supabase-queries";
import RealtimeSubscriber from "@/components/RealtimeSubscriber";

export default async function GamecastPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = await getGameById(gameId);
  if (!game) notFound();
  const events = await getGameEvents(game.id);

  return (
    <main className="page section">
      <RealtimeSubscriber gameId={game.id} />
      <p className="eyebrow">Gamecast</p>
      <h1>{game.away.team} at {game.home.team}</h1>
      <div className="actions" style={{ marginBottom: "2rem" }}>
        <Link className="button" href={`/live/${game.id}/box-score`}>Box Score</Link>
        <Link className="button-secondary" href={`/live/${game.id}`}>Live Game</Link>
      </div>
      <div className="grid two">
        <article className="card">
          <h2>Play-by-play</h2>
          <table className="table">
            <tbody>{events.map((event) => <tr key={event.id}><td>Q{event.period} {event.clock}</td><td>{event.description}</td></tr>)}</tbody>
          </table>
        </article>
        <article className="card">
          <h2>Shot markers</h2>
          <div style={{ position: "relative", width: "100%", aspectRatio: "50 / 47", background: "#f8fafc", border: "2px solid #cbd5e1", borderRadius: "8px", overflow: "hidden" }}>
            <svg style={{ width: "100%", height: "100%", stroke: "#94a3b8", strokeWidth: "1.5", fill: "none" }} viewBox="0 0 50 47">
              <rect x="0" y="0" width="50" height="47" />
              <line x1="0" y1="47" x2="50" y2="47" />
              <path d="M 19 47 A 6 6 0 0 1 31 47" />
              <path d="M 3 0 L 3 14 A 22 22 0 0 0 47 14 L 47 0" />
              <rect x="19" y="0" width="12" height="19" />
              <path d="M 19 19 A 6 6 0 0 1 31 19" />
              <path d="M 19 19 A 6 6 0 0 0 31 19" strokeDasharray="1,1" />
              <line x1="22" y1="4" x2="28" y2="4" strokeWidth="2" />
              <line x1="25" y1="4" x2="25" y2="5" />
              <circle cx="25" cy="5.8" r="0.8" />
            </svg>
            {events.filter((event) => event.x && event.y).map((event) => {
              // Different colors for makes vs misses
              const isMake = event.points > 0;
              const bgColor = isMake ? "#16a34a" : "#ef4444"; // green for make, red for miss
              const markerShape = isMake ? "50%" : "0%"; // circle for make, square for miss

              return (
                <span 
                  key={event.id} 
                  title={event.description}
                  style={{ 
                    position: "absolute", 
                    left: `${event.x * 100}%`, 
                    top: `${event.y * 100}%`, 
                    width: 14, 
                    height: 14, 
                    background: bgColor, 
                    borderRadius: markerShape,
                    border: "2px solid #ffffff",
                    transform: "translate(-50%, -50%)",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                  }} 
                />
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", fontSize: "0.85rem", color: "#64748b" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><span style={{ width: 12, height: 12, background: "#16a34a", borderRadius: "50%" }}></span> Made Shot</span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><span style={{ width: 12, height: 12, background: "#ef4444" }}></span> Missed Shot</span>
          </div>
        </article>
      </div>
    </main>
  );
}
