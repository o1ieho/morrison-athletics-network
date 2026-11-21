import Link from "next/link";
import type { Recap } from "@/lib/recap";

/**
 * The story of a final in five seconds: one headline built from the game's
 * numbers, then three or four key moments that link to their play in the
 * play-by-play. Static: nothing animates.
 */
export function GameRecap({ recap }: { recap: Recap }) {
  return (
    <section className="recap" aria-label="Key moments">
      <p className="recap-kicker">Recap</p>
      <h2 className="recap-headline">{recap.headline}</h2>
      {recap.moments.length > 0 && (
        <ul className="recap-moments">
          {recap.moments.map((moment) => (
            <li key={moment.tag}>
              <span className={`tag ${moment.tag.endsWith("run") ? "run" : moment.tag === "Lead change" ? "lead" : "plain"}`}>{moment.tag}</span>
              {moment.eventId ? (
                <a href={`#play-${moment.eventId}`}>{moment.text}</a>
              ) : moment.playerSlug ? (
                <Link href={`/players/${moment.playerSlug}`}>{moment.text}</Link>
              ) : (
                <span>{moment.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
