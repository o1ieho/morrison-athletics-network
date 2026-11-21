import Link from "next/link";
import { LeaderBars } from "@/components/stats/leader-bars";
import { average, formatShortDay } from "@/lib/format";
import { lastMeeting, recentForm } from "@/lib/recap";
import type { GameSummary, RosterPlayer, SeasonStatLine } from "@/lib/types";

/** Season numbers the game page loads for an upcoming game. */
export type GamePreview = { stats: SeasonStatLine[]; games: GameSummary[] };

/**
 * What a pre-game page shows above the roster: season leaders, the last five
 * results and the last meeting with this opponent. All from existing season
 * stats and the schedule.
 */
export function PreGame({ game, roster, preview }: { game: GameSummary; roster: RosterPlayer[]; preview: GamePreview }) {
  const form = recentForm(preview.games, game.startsAt);
  const meeting = lastMeeting(preview.games, game);
  const players = new Map(roster.map((player) => [player.athleteId, player]));
  const leaders = (key: "pts" | "reb" | "ast") =>
    preview.stats
      .filter((line) => line.gp > 0)
      .sort((a, b) => b[key] / b.gp - a[key] / a.gp)
      .slice(0, 3)
      .flatMap((line) => {
        const player = players.get(line.athleteId);
        return player ? [{ player, value: line[key] / line.gp, display: average(line[key], line.gp) }] : [];
      });

  return (
    <>
      {preview.stats.length > 0 && (
        <section aria-label="Season leaders">
          <div className="section-head">
            <h2>Season leaders</h2>
          </div>
          <div className="card card-pad leaders-grid">
            <LeaderBars title="Points" rows={leaders("pts")} unit="PPG" />
            <LeaderBars title="Rebounds" rows={leaders("reb")} unit="RPG" />
            <LeaderBars title="Assists" rows={leaders("ast")} unit="APG" />
          </div>
        </section>
      )}

      <div className="pregame-row">
        <section aria-label="Form">
          <div className="section-head">
            <h2>Form</h2>
            <span className="muted small">Last {form.length || 5}</span>
          </div>
          {form.length ? (
            <ol className="form-tiles">
              {form.map(({ game: result, result: letter }) => (
                <li key={result.id}>
                  <Link
                    href={`/games/${result.id}`}
                    className={`form-tile ${letter}`}
                    title={`${letter} ${result.teamScore}–${result.opponentScore} ${result.isHome ? "vs" : "at"} ${result.opponent.shortName}`}
                  >
                    <strong>{letter}</strong>
                    <span className="tabular">
                      {result.teamScore}–{result.opponentScore}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="card empty">No results yet this season.</p>
          )}
        </section>

        <section aria-label="Last meeting">
          <div className="section-head">
            <h2>Last meeting</h2>
          </div>
          {meeting ? (
            <Link href={`/games/${meeting.id}`} className="card last-meeting">
              <span className="muted small">
                {formatShortDay(meeting.startsAt)} · {meeting.isHome ? "Home" : "Away"}
              </span>
              <span className="last-meeting-score tabular">
                Broncos {meeting.teamScore}–{meeting.opponentScore} {meeting.opponent.shortName}
              </span>
              <span className="see-all">Recap</span>
            </Link>
          ) : (
            <p className="card empty">First meeting this season.</p>
          )}
        </section>
      </div>
    </>
  );
}
