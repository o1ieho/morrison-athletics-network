import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/games";
import { requireStaff } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { getData } from "@/lib/data";
import { dateKey, formatDateTime, teamLabel } from "@/lib/format";
import type { GameSummary } from "@/lib/types";
import "./operator.css";

export const metadata: Metadata = { title: "Live operator" };

export default async function OperatorHome() {
  const user = await requireStaff("operate", "/operator");
  const games = await (await getData()).getGames();

  const today = dateKey(new Date());
  const live = games.filter((game) => game.status === "live");
  const todays = games.filter((game) => game.status === "scheduled" && dateKey(game.startsAt) === today);
  const upcoming = games.filter((game) => game.status === "scheduled" && dateKey(game.startsAt) > today).slice(0, 8);
  const recent = games
    .filter((game) => game.status === "final")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 5);

  return (
    <main className="op-picker">
      <div className="op-picker-inner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p className="eyebrow">Live operator</p>
            <h1>Pick a game</h1>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", color: "#97a39c", fontSize: "0.85rem" }}>
            <span>{user.email}</span>
            {user.isAdmin && <Link href="/admin">Admin</Link>}
            {!isDemoMode && (
              <form action="/auth/signout" method="post">
                <button type="submit" style={{ background: "none", border: 0, color: "#6fcf97", textDecoration: "underline", cursor: "pointer" }}>
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
        <GameGroup title="Live now" games={live} />
        <GameGroup title="Today" games={todays} />
        <GameGroup title="Upcoming" games={upcoming} />
        <GameGroup title="Recent (for corrections)" games={recent} />
        {!games.length && <p style={{ color: "#97a39c" }}>No games this season yet. An admin can add them under Admin → Games.</p>}
        <Link href="/" style={{ color: "#97a39c", fontSize: "0.85rem" }}>
          ← Back to the public site
        </Link>
      </div>
    </main>
  );
}

function GameGroup({ title, games }: { title: string; games: GameSummary[] }) {
  if (!games.length) return null;
  return (
    <section className="op-picker-list">
      <p className="eyebrow">{title}</p>
      {games.map((game) => (
        <Link key={game.id} href={`/operator/${game.id}`} className="op-picker-game">
          <span style={{ display: "grid", gap: 2 }}>
            <strong>
              Broncos {game.isHome ? "vs" : "at"} {game.opponent.shortName}
            </strong>
            <span>
              {teamLabel(game.team)} · {formatDateTime(game.startsAt)}
              {game.status !== "scheduled" && ` · ${game.teamScore}–${game.opponentScore}`}
            </span>
          </span>
          <StatusBadge game={game} />
        </Link>
      ))}
    </section>
  );
}
