import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Megaphone, Radio } from "lucide-react";
import { AnnouncementCard, AthleteCard, GameCard } from "@/components/cards";
import { getAnnouncements, getAthletes, getGames, getMediaAssets } from "@/lib/supabase-queries";

export default async function HomePage() {
  const [announcements, athletes, games, mediaAssets] = await Promise.all([
    getAnnouncements(),
    getAthletes(),
    getGames(),
    getMediaAssets(),
  ]);

  const featuredGame = games.find((game) => game.status === "live") || games[0];
  const upcoming = games.filter((game) => game.status === "scheduled").slice(0, 3);
  const recent = games.filter((game) => game.status === "final").slice(0, 3);

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-brand-card" aria-hidden="true">
          <Image src="/brand/broncos-wordmark-cropped.png" alt="" width={340} height={384} priority />
        </div>
        <div className="hero-content">
          <p className="eyebrow">Official Athletics Hub</p>
          <h1>Morrison Academy Taipei Athletics.</h1>
          <p>
            The central home for Broncos teams, schedules, live games, announcements, athletes, and media across the
            school year.
          </p>
          <div className="hero-actions">
            {featuredGame && (
              <Link className="button" href={`/live/${featuredGame.id}`}>
                <Radio size={18} /> Live Games
              </Link>
            )}
            <Link className="button-secondary" href="/schedule">
              <CalendarDays size={18} /> View Schedule
            </Link>
            <Link className="button-ghost" href="/announcements">
              <Megaphone size={18} /> Announcements
            </Link>
          </div>
        </div>
      </section>

      <section className="scoreboard-strip" aria-label="Featured athletics schedule">
        <div className="scoreboard-label">Calendar</div>
        {games.slice(0, 3).map((game) => (
          <Link className="scoreboard-item" href={`/live/${game.id}`} key={game.id}>
            <span>{new Date(game.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <strong>{game.away.team} at {game.home.team}</strong>
            <em>{game.displayStatus}</em>
          </Link>
        ))}
        <Link className="scoreboard-action" href="/schedule">
          Composite <CalendarDays size={18} />
        </Link>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Live Games</p>
            <h2>Game coverage</h2>
          </div>
          <Link href="/live">All live games <ArrowRight size={16} /></Link>
        </div>
        <div className="grid three">
          {games.slice(0, 3).map((game) => <GameCard game={game} key={game.id} />)}
        </div>
      </section>

      <section className="section alt">
        <div className="grid two">
          <div>
            <div className="section-head">
              <div>
                <p className="eyebrow">Announcements</p>
                <h2>Department updates</h2>
              </div>
            </div>
            <div className="grid">
              {announcements.slice(0, 2).map((announcement) => <AnnouncementCard announcement={announcement} key={announcement.id} />)}
            </div>
          </div>
          <div>
            <div className="section-head">
              <div>
                <p className="eyebrow">Upcoming</p>
                <h2>Schedule</h2>
              </div>
            </div>
            <div className="grid">
              {upcoming.map((game) => <GameCard game={game} key={game.id} />)}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Featured Athletes</p>
            <h2>Broncos to watch</h2>
          </div>
          <Link href="/athletes">Athlete directory <ArrowRight size={16} /></Link>
        </div>
        <div className="grid four">
          {athletes.slice(0, 4).map((athlete) => <AthleteCard athlete={athlete} key={athlete.id} />)}
        </div>
      </section>

      <section className="section alt">
        <div className="grid two">
          <div>
            <p className="eyebrow">Recent Results</p>
            <h2>Finished games</h2>
            <div className="grid">
              {recent.length ? recent.map((game) => <GameCard game={game} key={game.id} />) : <p className="meta">No final games yet.</p>}
            </div>
          </div>
          <div>
            <p className="eyebrow">Media</p>
            <h2>Highlights and galleries</h2>
            <div className="grid">
              {mediaAssets.slice(0, 2).map((asset) => (
                <article className="feature-card" key={asset.id}>
                  <p className="eyebrow">{asset.type}</p>
                  <h3>{asset.title}</h3>
                  <p>{asset.caption}</p>
                  <Link className="button-secondary" href="/media">Open Media</Link>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
