import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { GameRow, ScoreStrip, StatusBadge, stripGames } from "@/components/games";
import { getData } from "@/lib/data";
import { average, formatDateTime, formatDay, teamLabel } from "@/lib/format";
import type { GameSummary, RosterPlayer, SeasonStatLine, Team, TeamRecord } from "@/lib/types";

export default async function HomePage() {
  const data = await getData();
  const [season, teams, games, records, stats, roster, announcements] = await Promise.all([
    data.getSeason(),
    data.getTeams(),
    data.getGames(),
    data.getTeamRecords(),
    data.getSeasonStats(),
    data.getRoster(),
    data.getAnnouncements(),
  ]);

  const now = Date.now();
  const live = games.filter((game) => game.status === "live");
  const upcoming = games.filter((game) => game.status === "scheduled" && Date.parse(game.startsAt) >= now - 3 * 3600_000);
  const results = games
    .filter((game) => game.status === "final")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const featured = live[0] ?? upcoming[0] ?? results[0];

  return (
    <main>
      <AutoRefresh enabled={live.length > 0} />
      <ScoreStrip games={stripGames(games, now)} />

      <section className="hero">
        <div className="container">
          <Image className="hero-mark" src="/brand/broncos-head-cropped.png" alt="" width={112} height={112} priority />
          <div className="stack" style={{ gap: 8 }}>
            <p className="eyebrow" style={{ color: "var(--silver)" }}>
              {season.name}
            </p>
            <h1>Broncos Basketball</h1>
            <p>Live scores, box scores, schedules and stats for all four Morrison Academy Taipei basketball teams.</p>
          </div>
        </div>
      </section>

      <div className="container page stack-lg">
        {featured && <FeaturedGame game={featured} />}

        <div className="split">
          <div className="stack-lg">
            <section>
              <div className="section-head">
                <h2>Upcoming</h2>
                <Link href="/schedule">
                  Full schedule <ArrowRight size={16} />
                </Link>
              </div>
              <div className="card game-list">
                {upcoming.slice(0, 5).map((game) => (
                  <GameRow key={game.id} game={game} />
                ))}
                {!upcoming.length && <p className="empty">No upcoming games posted yet.</p>}
              </div>
            </section>

            <section>
              <div className="section-head">
                <h2>Latest results</h2>
                <Link href="/schedule?view=results">
                  All results <ArrowRight size={16} />
                </Link>
              </div>
              <div className="card game-list">
                {results.slice(0, 5).map((game) => (
                  <GameRow key={game.id} game={game} />
                ))}
                {!results.length && <p className="empty">No results yet this season.</p>}
              </div>
            </section>
          </div>

          <div className="stack-lg">
            <TeamsCard teams={teams} records={records} />
            <ScoringLeaders stats={stats} roster={roster} teams={teams} />
            {announcements.length > 0 && (
              <section>
                <div className="section-head">
                  <h2>News</h2>
                  <Link href="/news">
                    All news <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="card game-list">
                  {announcements.slice(0, 3).map((item) => (
                    <Link key={item.id} href={`/news/${item.slug}`} className="game-row" style={{ gridTemplateColumns: "1fr" }}>
                      <span className="game-main">
                        <strong>{item.title}</strong>
                        <span>{item.publishedAt ? formatDay(item.publishedAt) : ""}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function FeaturedGame({ game }: { game: GameSummary }) {
  const hasScore = game.status === "live" || game.status === "final";
  const label = game.status === "live" ? "Live now" : game.status === "final" ? "Latest result" : "Next game";
  return (
    <section>
      <div className="section-head">
        <h2>{label}</h2>
      </div>
      <Link href={`/games/${game.id}`} className="scoreboard" style={{ display: "block" }}>
        <div className="scoreboard-top">
          <span>
            {teamLabel(game.team)} · {formatDateTime(game.startsAt)}
          </span>
          <span>{game.location}</span>
        </div>
        <div className="scoreboard-body">
          <div className="sb-team">
            <Image className="sb-mark" src="/brand/broncos-head-cropped.png" alt="" width={56} height={56} />
            <span className="sb-team-name">Broncos</span>
            {hasScore && <span className="sb-score">{game.teamScore}</span>}
          </div>
          <div className="sb-center">
            <StatusBadge game={game} />
            {!hasScore && <span className="sb-period">{game.isHome ? "Home" : "Away"}</span>}
            <span className="small" style={{ color: "var(--silver)" }}>
              {game.status === "live" ? "Tap for play-by-play" : hasScore ? "Box score" : "Game preview"} →
            </span>
          </div>
          <div className="sb-team">
            <span className="sb-mark opponent" aria-hidden="true">
              {game.opponent.shortName.slice(0, 1)}
            </span>
            <span className="sb-team-name">{game.opponent.shortName}</span>
            {hasScore && <span className="sb-score">{game.opponentScore}</span>}
          </div>
        </div>
      </Link>
    </section>
  );
}

function TeamsCard({ teams, records }: { teams: Team[]; records: TeamRecord[] }) {
  return (
    <section>
      <div className="section-head">
        <h2>Teams</h2>
        <Link href="/teams">
          All teams <ArrowRight size={16} />
        </Link>
      </div>
      <div className="card game-list">
        {teams.map((team) => {
          const record = records.find((entry) => entry.teamId === team.id);
          return (
            <Link key={team.id} href={`/teams/${team.slug}`} className="game-row" style={{ gridTemplateColumns: "1fr auto" }}>
              <span className="game-main">
                <strong>{teamLabel(team)}</strong>
                <span>{team.conference}</span>
              </span>
              <span className="game-score tabular">
                {record ? `${record.wins}–${record.losses}` : "0–0"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ScoringLeaders({ stats, roster, teams }: { stats: SeasonStatLine[]; roster: RosterPlayer[]; teams: Team[] }) {
  const top = [...stats]
    .filter((line) => line.gp > 0)
    .sort((a, b) => b.pts / b.gp - a.pts / a.gp)
    .slice(0, 5);
  if (!top.length) return null;
  const players = new Map(roster.map((player) => [player.athleteId, player]));
  const teamById = new Map(teams.map((team) => [team.id, team]));

  return (
    <section>
      <div className="section-head">
        <h2>Scoring leaders</h2>
        <Link href="/stats">
          All stats <ArrowRight size={16} />
        </Link>
      </div>
      <div className="card">
        {top.map((line) => {
          const player = players.get(line.athleteId);
          const team = teamById.get(line.teamId);
          if (!player) return null;
          return (
            <Link key={line.athleteId} href={`/players/${player.slug}`} className="leader">
              <span className="jersey-badge">{player.number ?? "–"}</span>
              <span>
                <strong>{player.name}</strong>
                <br />
                <span className="muted small">{team ? teamLabel(team) : ""}</span>
              </span>
              <span className="leader-value">
                <strong>{average(line.pts, line.gp)}</strong>
                <span>PPG</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
