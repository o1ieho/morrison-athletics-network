import type { Metadata } from "next";
import Link from "next/link";
import { AdminForm } from "@/components/admin/admin-form";
import { GameFields } from "@/components/admin/game-fields";
import { StatusBadge } from "@/components/games";
import { getAdminData } from "@/lib/admin-data";
import { formatDateTime, teamLabel } from "@/lib/format";
import { saveGame } from "../actions";

export const metadata: Metadata = { title: "Games · Admin" };

export default async function AdminGames() {
  const data = await getAdminData();
  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <p className="eyebrow">Admin</p>
        <h1>Games</h1>
      </div>

      {data.teams.map((team) => {
        const games = data.games.filter((game) => game.teamId === team.id);
        return (
          <section key={team.id}>
            <div className="section-head">
              <h2>{teamLabel(team)}</h2>
              <span className="muted small">{games.length} games</span>
            </div>
            <div className="card game-list">
              {games.map((game) => (
                <Link key={game.id} href={`/admin/games/${game.id}`} className="game-row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span className="game-main">
                    <strong>
                      {game.isHome ? "vs" : "at"} {game.opponent.name}
                    </strong>
                    <span>
                      {formatDateTime(game.startsAt)} · {game.location || "No location"}
                      {game.status === "final" || game.status === "live" ? ` · ${game.teamScore}–${game.opponentScore}` : ""}
                    </span>
                  </span>
                  <span className="game-side">
                    <StatusBadge game={game} />
                    <span className="small muted">Edit →</span>
                  </span>
                </Link>
              ))}
              {!games.length && <p className="empty">No games yet.</p>}
            </div>
          </section>
        );
      })}

      <section className="card card-pad stack" id="add">
        <h2>Add a game</h2>
        <AdminForm action={saveGame} submitLabel="Add game">
          <GameFields teams={data.teams} opponents={data.opponents} />
        </AdminForm>
      </section>
    </div>
  );
}
