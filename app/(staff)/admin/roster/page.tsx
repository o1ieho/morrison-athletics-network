import type { Metadata } from "next";
import Link from "next/link";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { getAdminData } from "@/lib/admin-data";
import { teamLabel } from "@/lib/format";
import type { RosterPlayer } from "@/lib/types";
import { removePlayer, savePlayer } from "../actions";

export const metadata: Metadata = { title: "Rosters · Admin" };

type Props = { searchParams: Promise<{ team?: string }> };

function PlayerFields({ player, teamId }: { player?: RosterPlayer; teamId: string }) {
  return (
    <>
      {player && <input type="hidden" name="athlete_id" value={player.athleteId} />}
      <input type="hidden" name="team_id" value={teamId} />
      <div className="form-row">
        <label className="field">
          Name
          <input name="full_name" required defaultValue={player?.name ?? ""} />
        </label>
        <label className="field">
          Jersey #
          <input name="jersey_number" type="number" min={0} max={99} defaultValue={player?.number ?? ""} />
        </label>
        <label className="field">
          Position
          <input name="position" defaultValue={player?.position ?? ""} placeholder="PG" />
        </label>
        <label className="field">
          Height
          <input name="height" defaultValue={player?.height ?? ""} placeholder={`5'10"`} />
        </label>
        <label className="field">
          Grade
          <input name="grade" defaultValue={player?.grade ?? ""} placeholder="11" />
        </label>
      </div>
    </>
  );
}

export default async function AdminRoster({ searchParams }: Props) {
  const { team: slug } = await searchParams;
  const data = await getAdminData();
  const team = data.teams.find((entry) => entry.slug === slug) ?? data.teams[0];
  if (!team) return <div className="card empty">No teams yet. Run supabase/seed.sql.</div>;
  const players = data.roster.filter((player) => player.teamId === team.id);

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <p className="eyebrow">Admin · Rosters</p>
        <h1>{teamLabel(team)}</h1>
      </div>
      <nav className="filters" aria-label="Team">
        {data.teams.map((entry) => (
          <Link key={entry.id} className="chip" href={`/admin/roster?team=${entry.slug}`} aria-current={entry.id === team.id}>
            {teamLabel(entry)}
          </Link>
        ))}
      </nav>

      <section className="card card-pad stack">
        <h2>Add a player</h2>
        <AdminForm action={savePlayer} submitLabel="Add player" resetOnSuccess>
          <PlayerFields teamId={team.id} />
        </AdminForm>
      </section>

      <section className="stack">
        {players.map((player) => (
          <details key={player.athleteId} className="card card-pad">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              <span className="muted">#{player.number ?? "–"}</span> {player.name}{" "}
              <span className="muted small">{[player.position, player.height].filter(Boolean).join(" · ")}</span>
            </summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <AdminForm action={savePlayer} submitLabel="Save">
                <PlayerFields player={player} teamId={team.id} />
              </AdminForm>
              <form action={removePlayer}>
                <input type="hidden" name="athlete_id" value={player.athleteId} />
                <input type="hidden" name="team_id" value={team.id} />
                <ConfirmButton className="button small secondary" message={`Remove ${player.name} from the ${teamLabel(team)} roster? Their past stats stay.`}>
                  Remove from roster
                </ConfirmButton>
              </form>
            </div>
          </details>
        ))}
        {!players.length && <div className="card empty">No players on this roster yet.</div>}
      </section>
    </div>
  );
}
