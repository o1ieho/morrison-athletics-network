import type { Metadata } from "next";
import Link from "next/link";
import { AdminForm } from "@/components/admin/admin-form";
import { getAdminData } from "@/lib/admin-data";
import { getData } from "@/lib/data";
import { teamLabel } from "@/lib/format";
import { saveStandings } from "../actions";

export const metadata: Metadata = { title: "Standings · Admin" };

type Props = { searchParams: Promise<{ team?: string }> };

/**
 * The league table for one team: each other school's win-loss record, copied
 * from the league's published standings. The Broncos' own record is worked
 * out from our final scores, so it isn't entered here.
 */
export default async function AdminStandings({ searchParams }: Props) {
  const [admin, data] = await Promise.all([getAdminData(), getData()]);
  const { team: teamParam } = await searchParams;
  const team = admin.teams.find((entry) => entry.id === teamParam) ?? admin.teams[0];
  const current = team ? await data.getStandings(team.id).catch(() => []) : [];
  const byOpponent = new Map(current.map((row) => [row.opponent.id, row]));

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <p className="eyebrow">Admin</p>
        <h1>League standings</h1>
        <p className="muted">
          Copy each school&apos;s win-loss record from the league table. Leave both boxes empty for a school that isn&apos;t in this
          league. The Broncos&apos; record comes from our final scores automatically.
        </p>
      </div>
      <div className="filters" role="group" aria-label="Team">
        {admin.teams.map((entry) => (
          <Link key={entry.id} href={`/admin/standings?team=${entry.id}`} className="chip" aria-current={entry.id === team?.id ? "page" : undefined}>
            {teamLabel(entry)}
          </Link>
        ))}
      </div>
      {team && (
        <section className="card card-pad stack">
          <h2>{teamLabel(team)}</h2>
          {admin.opponents.length ? (
            <AdminForm action={saveStandings} submitLabel="Save standings" key={team.id}>
              <input type="hidden" name="team_id" value={team.id} />
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">School</th>
                    <th scope="col">Wins</th>
                    <th scope="col">Losses</th>
                  </tr>
                </thead>
                <tbody>
                  {admin.opponents.map((opponent) => {
                    const row = byOpponent.get(opponent.id);
                    return (
                      <tr key={opponent.id}>
                        <th scope="row">{opponent.name}</th>
                        <td>
                          <input name={`w:${opponent.id}`} type="number" min={0} max={200} inputMode="numeric" defaultValue={row?.wins ?? ""} aria-label={`${opponent.name} wins`} style={{ width: 80 }} />
                        </td>
                        <td>
                          <input name={`l:${opponent.id}`} type="number" min={0} max={200} inputMode="numeric" defaultValue={row?.losses ?? ""} aria-label={`${opponent.name} losses`} style={{ width: 80 }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AdminForm>
          ) : (
            <p className="muted">
              Add the league&apos;s schools under <Link href="/admin/opponents">Opponents</Link> first.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
