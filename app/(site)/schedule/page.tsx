import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, MapPin } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { GameRow, StatusBadge } from "@/components/games";
import { googleCalendarAddUrl, googleCalendarSubscribeUrl, startMs, type CalendarEvent } from "@/lib/calendar";
import { getData } from "@/lib/data";
import { getSchedule } from "@/lib/data/calendar";
import { dateKey, formatDay, formatTime } from "@/lib/format";
import type { GameSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Schedule" };

/** A tracked game on the same Taipei day whose opponent is named in the event title. */
function matchGame(event: CalendarEvent, games: GameSummary[]) {
  const day = event.allDay ? event.start : dateKey(event.start);
  const title = event.title.toLowerCase();
  return games.find(
    (game) =>
      dateKey(game.startsAt) === day &&
      [game.opponent.shortName, game.opponent.name].some((name) => name && title.includes(name.toLowerCase())),
  );
}

function groupByDay(events: CalendarEvent[]) {
  const days: Array<{ key: string; label: string; events: CalendarEvent[] }> = [];
  for (const event of events) {
    const key = event.allDay ? event.start : dateKey(event.start);
    const last = days[days.length - 1];
    if (last?.key === key) last.events.push(event);
    else days.push({ key, label: formatDay(new Date(startMs(event)).toISOString()), events: [event] });
  }
  return days;
}

function timeLabel(event: CalendarEvent) {
  return event.allDay ? "All day" : formatTime(event.start);
}

export default async function SchedulePage() {
  const [schedule, data] = await Promise.all([getSchedule(), getData()]);
  const games = await data.getGames();
  const results = games
    .filter((game) => game.status === "final")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 8);
  const hasLive = games.some((game) => game.status === "live");

  return (
    <main className="page">
      <AutoRefresh enabled={hasLive} />
      <div className="container stack-lg">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <p className="eyebrow">Broncos athletics</p>
          <h1>Schedule</h1>
          {schedule.status !== "not-configured" && (
            <div className="filters" style={{ marginTop: 8, marginBottom: 0 }}>
              <a className="chip" href={googleCalendarAddUrl(schedule.calendarId)} target="_blank" rel="noreferrer">
                <CalendarPlus size={16} style={{ marginRight: 6 }} /> Add to Google Calendar
              </a>
              <a className="chip" href={googleCalendarSubscribeUrl(schedule.calendarId)}>
                Subscribe on iPhone / Outlook
              </a>
            </div>
          )}
        </div>

        {schedule.status === "ok" ? (
          <CalendarDays events={schedule.events} games={games} />
        ) : (
          <>
            {schedule.status === "error" && (
              <div className="notice">The team calendar is temporarily unavailable. Showing games from our system instead.</div>
            )}
            <UpcomingGames games={games} />
          </>
        )}

        <section>
          <div className="section-head">
            <h2>Recent results</h2>
            <Link href="/teams">By team →</Link>
          </div>
          <div className="card game-list">
            {results.map((game) => (
              <GameRow key={game.id} game={game} />
            ))}
            {!results.length && <p className="empty">No results yet this season.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function CalendarDays({ events, games }: { events: CalendarEvent[]; games: GameSummary[] }) {
  if (!events.length) return <div className="card empty">Nothing on the calendar for the next few months.</div>;
  return (
    <div className="stack">
      {groupByDay(events).map((day) => (
        <section key={day.key}>
          <h2 className="cal-day-label">{day.label}</h2>
          <div className="card game-list">
            {day.events.map((event) => {
              const game = matchGame(event, games);
              return (
                <article key={event.id} className="cal-event">
                  <span className="cal-time">{timeLabel(event)}</span>
                  <div className="cal-body">
                    <strong>{event.title}</strong>
                    {event.location && (
                      <span className="cal-meta">
                        <MapPin size={14} /> {event.location}
                      </span>
                    )}
                    {event.description && <p className="cal-note">{event.description}</p>}
                  </div>
                  {game && (
                    <Link href={`/games/${game.id}`} className="cal-game">
                      <StatusBadge game={game} />
                      <span>{game.status === "live" || game.status === "final" ? `${game.teamScore}–${game.opponentScore}` : "Game page"} →</span>
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Shown until the Google Calendar is connected (or if it's unreachable): upcoming games from our database. */
function UpcomingGames({ games }: { games: GameSummary[] }) {
  const now = Date.now();
  const upcoming = games.filter(
    (game) => game.status === "live" || (game.status === "scheduled" && Date.parse(game.startsAt) >= now - 3 * 3600_000),
  );
  return (
    <section>
      <div className="section-head">
        <h2>Upcoming games</h2>
      </div>
      <div className="card game-list">
        {upcoming.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
        {!upcoming.length && <p className="empty">No upcoming games posted yet.</p>}
      </div>
    </section>
  );
}
