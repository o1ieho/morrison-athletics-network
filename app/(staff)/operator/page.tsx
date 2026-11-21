import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/games";
import { UnsentBadge } from "@/components/operator/unsent-badge";
import { requireStaff } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { getData } from "@/lib/data";
import { dateKey, formatDateTime, teamLabel } from "@/lib/format";
import { canOperateGame, OPERATOR_WINDOW_HOURS } from "@/lib/operator-window";
import type { StaffUser } from "@/lib/auth";
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
        {!user.isAdmin && (
          <p style={{ color: "#97a39c", margin: 0 }}>
            You can run a game from {OPERATOR_WINDOW_HOURS} hours before tip-off until {OPERATOR_WINDOW_HOURS} hours after. For anything
            outside that, ask an admin.
          </p>
        )}
        <GameGroup title="Live now" games={live} user={user} />
        <GameGroup title="Today" games={todays} user={user} />
        <GameGroup title="Upcoming" games={upcoming} user={user} />
        <GameGroup title={user.isAdmin ? "Recent (for corrections)" : "Recent"} games={recent} user={user} />
        {!games.length && <p style={{ color: "#97a39c" }}>No games this season yet. An admin can add them under Admin → Games.</p>}
        <Link href="/" style={{ color: "#97a39c", fontSize: "0.85rem" }}>
          ← Back to the public site
        </Link>
      </div>
    </main>
  );
}

function GameGroup({ title, games, user }: { title: string; games: GameSummary[]; user: StaffUser }) {
  if (!games.length) return null;
  // Rendered per request, so "now" is the time the list was opened.
  const now = Date.now();
  return (
    <section className="op-picker-list">
      <p className="eyebrow">{title}</p>
      {games.map((game) => {
        const body = (
          <span style={{ display: "grid", gap: 2 }}>
            <strong>
              Broncos {game.isHome ? "vs" : "at"} {game.opponent.shortName}
            </strong>
            <span>
              {teamLabel(game.team)} · {formatDateTime(game.startsAt)}
              {game.status !== "scheduled" && ` · ${game.teamScore}–${game.opponentScore}`}
            </span>
          </span>
        );
        if (!canOperateGame(game, user, now)) {
          const early = Date.parse(game.startsAt) > now;
          return (
            <div key={game.id} className="op-picker-game locked">
              {body}
              <span>{early ? "Opens on game day" : "Locked · ask an admin"}</span>
            </div>
          );
        }
        return (
          <Link key={game.id} href={`/operator/${game.id}`} className="op-picker-game">
            {body}
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <UnsentBadge gameId={game.id} />
              <StatusBadge game={game} />
            </span>
          </Link>
        );
      })}
    </section>
  );
}
