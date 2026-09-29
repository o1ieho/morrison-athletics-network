import Link from "next/link";
import { MapPin, Play } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { FeaturedGame } from "@/components/featured-game";
import { startMs, type CalendarEvent } from "@/lib/calendar";
import { getData } from "@/lib/data";
import { getSchedule } from "@/lib/data/calendar";
import { formatDay, formatShortDay, formatTime, teamLabel } from "@/lib/format";
import type { Announcement, GameSummary, MediaItem, Team, TeamRecord } from "@/lib/types";

export default async function HomePage() {
  const data = await getData();
  const [games, teams, records, announcements, media, schedule] = await Promise.all([
    data.getGames(),
    data.getTeams(),
    data.getTeamRecords(),
    data.getAnnouncements(),
    data.getMedia(6),
    getSchedule(),
  ]);

  const now = Date.now();
  const live = games.filter((game) => game.status === "live");
  const upcomingGames = games.filter((game) => game.status === "scheduled" && Date.parse(game.startsAt) >= now - 3 * 3600_000);
  const latestResult = games
    .filter((game) => game.status === "final")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];

  // Live games first; otherwise the next game, otherwise the latest result.
  const featured = live.length ? live : upcomingGames[0] ? [upcomingGames[0]] : latestResult ? [latestResult] : [];
  const snapshots = await Promise.all(
    featured.map(async (game) => ({
      game,
      events: await data.getGameEvents(game.id),
      roster: await data.getRoster(game.teamId),
    })),
  );
  const featureTitle = live.length ? "Live now" : upcomingGames[0] ? "Next game" : "Latest result";

  return (
    <main className="home">
      <AutoRefresh enabled={live.length > 0} seconds={30} />
      <div className="container stack-lg">
        {snapshots.length > 0 && (
          <section>
            <div className="home-head">
              <h2>
                {featureTitle}
                {live.length > 0 && <span className="live-dot" aria-label="(live)" />}
              </h2>
            </div>
            <div className="stack">
              {snapshots.map((snapshot) => (
                <FeaturedGame key={snapshot.game.id} initial={snapshot} />
              ))}
            </div>
          </section>
        )}

        <div className="home-row">
          <section>
            <div className="home-head">
              <h2>Upcoming</h2>
              <Link className="see-all" href="/schedule">
                See full schedule
              </Link>
            </div>
            <div className="panel">
              {schedule.status === "ok" ? (
                <UpcomingEvents events={schedule.events.slice(0, 4)} />
              ) : (
                <UpcomingGames games={upcomingGames.slice(0, 4)} />
              )}
            </div>
          </section>

          <section>
            <div className="home-head">
              <h2>Latest news</h2>
              <Link className="see-all" href="/news">
                See all news
              </Link>
            </div>
            <div className="panel">
              <LatestNews items={announcements.filter((item) => item.publishedAt).slice(0, 3)} />
            </div>
          </section>
        </div>

        <div className="home-row">
          <section>
            <div className="home-head">
              <h2>Teams</h2>
              <Link className="see-all" href="/teams">
                See all teams
              </Link>
            </div>
            <div className="panel">
              <TeamRecords teams={teams} records={records} />
            </div>
          </section>

          <section>
            <div className="home-head">
              <h2>Media</h2>
              <Link className="see-all" href="/media">
                See all media
              </Link>
            </div>
            <div className="panel">
              <MediaTiles items={media} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function DateBlock({ iso }: { iso: string }) {
  const [month, day] = formatShortDay(iso).split(" ");
  return (
    <span className="date-block">
      <span>{month}</span>
      <strong>{day}</strong>
    </span>
  );
}

function UpcomingEvents({ events }: { events: CalendarEvent[] }) {
  if (!events.length) return <p className="panel-empty">Nothing on the calendar yet.</p>;
  return (
    <div className="panel-list">
      {events.map((event) => (
        <Link key={event.id} href="/schedule" className="panel-row">
          <DateBlock iso={new Date(startMs(event)).toISOString()} />
          <span className="panel-main">
            <strong>{event.title}</strong>
            <span>
              {event.allDay ? "All day" : formatTime(event.start)}
              {event.location && (
                <>
                  {" · "}
                  <MapPin size={13} style={{ verticalAlign: "-2px" }} /> {event.location}
                </>
              )}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function UpcomingGames({ games }: { games: GameSummary[] }) {
  if (!games.length) return <p className="panel-empty">No upcoming games posted yet.</p>;
  return (
    <div className="panel-list">
      {games.map((game) => (
        <Link key={game.id} href={`/games/${game.id}`} className="panel-row">
          <DateBlock iso={game.startsAt} />
          <span className="panel-main">
            <strong>
              {teamLabel(game.team)} {game.isHome ? "vs" : "at"} {game.opponent.name}
            </strong>
            <span>
              {formatTime(game.startsAt)}
              {game.location ? ` · ${game.location}` : ""}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function LatestNews({ items }: { items: Announcement[] }) {
  if (!items.length) return <p className="panel-empty">No news yet. Check back soon.</p>;
  return (
    <div className="panel-list">
      {items.map((item) => (
        <Link key={item.id} href={`/news/${item.slug}`} className="panel-row news">
          <span className="panel-main">
            <span className="panel-kicker">{item.publishedAt ? formatDay(item.publishedAt) : ""}</span>
            <strong>{item.title}</strong>
            {item.summary && <span className="clamp-2">{item.summary}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}

function TeamRecords({ teams, records }: { teams: Team[]; records: TeamRecord[] }) {
  return (
    <div className="panel-list">
      {teams.map((team) => {
        const record = records.find((entry) => entry.teamId === team.id);
        return (
          <Link key={team.id} href={`/teams/${team.slug}`} className="team-line">
            <span>
              <strong>{teamLabel(team)} Basketball</strong>
              <span className="team-league">{team.conference}</span>
            </span>
            <span className="team-record">
              {record?.wins ?? 0} - {record?.losses ?? 0}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function MediaTiles({ items }: { items: MediaItem[] }) {
  if (!items.length) return <p className="panel-empty">Photos and highlights from the season will appear here.</p>;
  return (
    <div className="media-tiles">
      {items.map((item) => (
        <Link key={item.id} href={`/media#${item.id}`} className="media-tile" aria-label={item.title || (item.kind === "video" ? "Video" : "Photo")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Storage thumbnails are already sized */}
          <img src={item.thumbnailUrl ?? item.url} alt="" loading="lazy" />
          {item.kind === "video" && (
            <span className="media-play" aria-hidden="true">
              <Play size={22} fill="currentColor" />
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
