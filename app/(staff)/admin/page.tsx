import type { Metadata } from "next";
import Link from "next/link";
import { getAdminData } from "@/lib/admin-data";
import { dateKey, teamLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const data = await getAdminData();
  const today = dateKey(new Date());
  const upcoming = data.games.filter((game) => game.status === "scheduled" && dateKey(game.startsAt) >= today).length;
  const needsFinal = data.games.filter((game) => game.status === "live" && dateKey(game.startsAt) < today);

  const cards = [
    { href: "/admin/games", title: "Games", detail: `${data.games.length} this season · ${upcoming} upcoming` },
    { href: "/admin/roster", title: "Rosters", detail: data.teams.map((team) => `${teamLabel(team)}: ${data.roster.filter((p) => p.teamId === team.id).length}`).join(" · ") },
    { href: "/admin/opponents", title: "Opponents", detail: `${data.opponents.length} schools` },
    { href: "/admin/news", title: "News", detail: `${data.announcements.length} posts` },
  ];

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <p className="eyebrow">Admin</p>
        <h1>Season control</h1>
      </div>
      {needsFinal.length > 0 && (
        <div className="notice error">
          {needsFinal.length} game{needsFinal.length > 1 ? "s are" : " is"} still marked live from a previous day:{" "}
          {needsFinal.map((game, index) => (
            <span key={game.id}>
              {index > 0 && ", "}
              <Link href={`/admin/games/${game.id}`} style={{ textDecoration: "underline" }}>
                {game.opponent.shortName}
              </Link>
            </span>
          ))}
          . Set them to Final.
        </div>
      )}
      <div className="grid-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="card team-card">
            <h2>{card.title}</h2>
            <span className="muted small">{card.detail}</span>
          </Link>
        ))}
      </div>
      <section className="card card-pad stack">
        <h2>Staff accounts</h2>
        <p className="muted small">
          Accounts are created in the Supabase dashboard (Authentication → Users → Add user), then given a role. See
          SETUP.md in the project for the exact steps. Stat operators can run games; admins can also edit everything here.
        </p>
      </section>
    </div>
  );
}
