import type { Metadata } from "next";
import Link from "next/link";
import { getData } from "@/lib/data";
import { formatDateTime, teamLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const data = await getData();
  const [teams, records, games, roster] = await Promise.all([data.getTeams(), data.getTeamRecords(), data.getGames(), data.getRoster()]);
  const now = Date.now();

  return (
    <main className="page">
      <div className="container">
        <div className="page-head">
          <p className="eyebrow">Broncos basketball</p>
          <h1>Teams</h1>
        </div>
        <div className="grid-4">
          {teams.map((team) => {
            const record = records.find((entry) => entry.teamId === team.id);
            const next = games.find((game) => game.teamId === team.id && game.status === "scheduled" && Date.parse(game.startsAt) >= now);
            const size = roster.filter((player) => player.teamId === team.id).length;
            return (
              <Link key={team.id} href={`/teams/${team.slug}`} className="card team-card">
                <p className="eyebrow">{team.conference}</p>
                <h2>{teamLabel(team)}</h2>
                <span className="record tabular">
                  {record?.wins ?? 0}–{record?.losses ?? 0}
                </span>
                <span className="muted small">
                  {size ? `${size} players` : "Roster coming soon"}
                  {next ? ` · Next: ${next.isHome ? "vs" : "at"} ${next.opponent.shortName}, ${formatDateTime(next.startsAt)}` : ""}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
