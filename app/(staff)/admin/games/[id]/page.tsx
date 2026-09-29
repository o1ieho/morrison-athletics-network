import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { GameFields } from "@/components/admin/game-fields";
import { getAdminData } from "@/lib/admin-data";
import { matchupLabel, teamLabel } from "@/lib/format";
import { deleteGame, saveGame } from "../../actions";

export const metadata: Metadata = { title: "Edit game · Admin" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export default async function AdminGame({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  const data = await getAdminData();
  const game = data.games.find((entry) => entry.id === id);
  if (!game) notFound();

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/admin/games" className="muted small">
          ← All games
        </Link>
        <p className="eyebrow">{teamLabel(game.team)}</p>
        <h1>{matchupLabel(game)}</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="button small" href={`/operator/${game.id}`}>
            Open in operator
          </Link>
          <Link className="button small secondary" href={`/games/${game.id}`}>
            Public page
          </Link>
        </div>
      </div>
      {created && <div className="notice">Game added.</div>}
      <section className="card card-pad">
        <AdminForm action={saveGame} submitLabel="Save changes">
          <GameFields game={game} teams={data.teams} opponents={data.opponents} />
        </AdminForm>
      </section>
      <section className="card card-pad stack">
        <h2>Delete game</h2>
        <p className="muted small">Deletes the game and every play logged in it. This can&apos;t be undone.</p>
        <form action={deleteGame}>
          <input type="hidden" name="id" value={game.id} />
          <ConfirmButton message={`Delete ${matchupLabel(game)} and all of its plays? This can't be undone.`}>Delete this game</ConfirmButton>
        </form>
      </section>
    </div>
  );
}
