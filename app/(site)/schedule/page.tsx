import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { GameRow } from "@/components/games";
import { getData } from "@/lib/data";
import { teamLabel } from "@/lib/format";
import { SCHOOL_TIME_ZONE } from "@/lib/config";
import type { GameSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Schedule" };

type Props = { searchParams: Promise<{ team?: string; view?: string }> };

const monthFormat = new Intl.DateTimeFormat("en-US", { timeZone: SCHOOL_TIME_ZONE, month: "long", year: "numeric" });

export default async function SchedulePage({ searchParams }: Props) {
  const { team: teamSlug, view = "all" } = await searchParams;
  const data = await getData();
  const [teams, allGames] = await Promise.all([data.getTeams(), data.getGames()]);
  const team = teams.find((entry) => entry.slug === teamSlug);

  let games = team ? allGames.filter((game) => game.teamId === team.id) : allGames;
  if (view === "upcoming") games = games.filter((game) => game.status === "scheduled" || game.status === "live");
  if (view === "results") games = games.filter((game) => game.status === "final").reverse();

  const months: Array<{ label: string; games: GameSummary[] }> = [];
  for (const game of games) {
    const label = monthFormat.format(new Date(game.startsAt));
    const last = months[months.length - 1];
    if (last?.label === label) last.games.push(game);
    else months.push({ label, games: [game] });
  }

  const href = (params: { team?: string; view?: string }) => {
    const query = new URLSearchParams();
    const nextTeam = "team" in params ? params.team : teamSlug;
    const nextView = "view" in params ? params.view : view;
    if (nextTeam) query.set("team", nextTeam);
    if (nextView && nextView !== "all") query.set("view", nextView);
    const text = query.toString();
    return text ? `/schedule?${text}` : "/schedule";
  };

  return (
    <main className="page">
      <AutoRefresh enabled={allGames.some((game) => game.status === "live")} />
      <div className="container">
        <div className="page-head">
          <p className="eyebrow">Schedule & results</p>
          <h1>{team ? teamLabel(team) : "All teams"}</h1>
        </div>

        <nav className="filters" aria-label="Team">
          <Link className="chip" href={href({ team: undefined })} aria-current={!team}>
            All teams
          </Link>
          {teams.map((entry) => (
            <Link key={entry.id} className="chip" href={href({ team: entry.slug })} aria-current={team?.id === entry.id}>
              {teamLabel(entry)}
            </Link>
          ))}
        </nav>
        <nav className="tabs" aria-label="View" style={{ maxWidth: 420, marginTop: 0 }}>
          {[
            ["all", "All"],
            ["upcoming", "Upcoming"],
            ["results", "Results"],
          ].map(([value, label]) => (
            <Link key={value} href={href({ view: value })} aria-current={view === value ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="stack">
          {months.map((month) => (
            <section key={month.label}>
              <h2 style={{ fontSize: "1.1rem", margin: "8px 0 10px" }}>{month.label}</h2>
              <div className="card game-list">
                {month.games.map((game) => (
                  <GameRow key={game.id} game={game} showTeam={!team} />
                ))}
              </div>
            </section>
          ))}
          {!months.length && <div className="card empty">No games to show.</div>}
        </div>
      </div>
    </main>
  );
}
