import Link from "next/link";
import { ArrowRight, CalendarDays, Radio } from "lucide-react";
import type { Announcement, Athlete, Game, Team } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function GameCard({ game }: { game: Game }) {
  return (
    <article className="card">
      <span className={`status ${game.status === "live" ? "live" : ""}`}>{game.displayStatus}</span>
      <div className="scoreline">
        <span>{game.away.team}</span>
        <strong>{game.away.score}</strong>
      </div>
      <div className="scoreline">
        <span>{game.home.team}</span>
        <strong>{game.home.score}</strong>
      </div>
      <p className="meta">{game.location} · {formatDate(game.startsAt)}</p>
      <p>{game.leaders}</p>
      <div className="actions">
        <Link className="button" href={`/live/${game.id}`}>
          <Radio size={16} /> Live
        </Link>
        <Link className="button-secondary" href={`/live/${game.id}/box-score`}>
          Box Score
        </Link>
      </div>
    </article>
  );
}

export function TeamCard({ team }: { team: Team }) {
  const genderLabel = team.gender && team.gender !== "opponent" ? `${team.gender[0].toUpperCase()}${team.gender.slice(1)} · ` : "";
  const statusLabel = team.seasonStatus.replace("_", " ");

  return (
    <article className="card">
      <p className="eyebrow">{team.sport} · {genderLabel}{team.level}</p>
      <h3>{team.city} {team.name}</h3>
      <p className="meta">{team.conference}</p>
      <div className="stat-strip">
        <span><strong>{team.record}</strong><small>Record</small></span>
        <span><strong>{team.sport}</strong><small>Sport</small></span>
        <span><strong>{statusLabel}</strong><small>Season</small></span>
      </div>
      <Link className="button-secondary" href={`/teams/${team.slug}`}>
        Team Page <ArrowRight size={16} />
      </Link>
    </article>
  );
}

export function AthleteCard({ athlete }: { athlete: Athlete }) {
  return (
    <article className="card">
      <p className="eyebrow">#{athlete.number || "-"} · {athlete.position} · Grade {athlete.grade}</p>
      <h3>{athlete.name}</h3>
      <p className="meta">{athlete.bio}</p>
      <div className="stat-strip">
        <span><strong>{athlete.points}</strong><small>PTS</small></span>
        <span><strong>{athlete.rebounds}</strong><small>REB</small></span>
        <span><strong>{athlete.assists}</strong><small>AST</small></span>
      </div>
      <Link className="button-secondary" href={`/athletes/${athlete.slug}`}>
        Profile <ArrowRight size={16} />
      </Link>
    </article>
  );
}

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <article className="card">
      <p className="eyebrow">{announcement.pinned ? "Pinned · " : ""}{announcement.category.replace("-", " ")}</p>
      <h3>{announcement.title}</h3>
      <p>{announcement.summary}</p>
      <p className="meta">{announcement.author} · {formatDate(announcement.publishedAt)}</p>
      <Link className="button-secondary" href={`/announcements/${announcement.slug}`}>
        Read Update <ArrowRight size={16} />
      </Link>
    </article>
  );
}

export function ScheduleRow({ game }: { game: Game }) {
  return (
    <tr>
      <td><CalendarDays size={16} /> {formatDate(game.startsAt)}</td>
      <td><strong>{game.sport}</strong><br />{game.away.team} at {game.home.team}</td>
      <td>{game.location}</td>
      <td><span className={`status ${game.status === "live" ? "live" : ""}`}>{game.displayStatus}</span></td>
      <td><Link href={`/live/${game.id}`}>View</Link></td>
    </tr>
  );
}
