import { isoToTaipeiLocal, teamLabel } from "@/lib/format";
import type { GameSummary, Opponent, Team } from "@/lib/types";

/** Inputs for creating or editing a game. Times are entered in Taipei time. */
export function GameFields({ game, teams, opponents }: { game?: GameSummary; teams: Team[]; opponents: Opponent[] }) {
  return (
    <>
      {game && <input type="hidden" name="id" value={game.id} />}
      <div className="form-row">
        <label className="field">
          Team
          <select name="team_id" defaultValue={game?.teamId ?? teams[0]?.id} required>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {teamLabel(team)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Opponent
          <select name="opponent_id" defaultValue={game?.opponentId ?? ""} required>
            <option value="" disabled>
              Choose…
            </option>
            {opponents.map((opponent) => (
              <option key={opponent.id} value={opponent.id}>
                {opponent.name}
              </option>
            ))}
          </select>
          <span className="hint">Missing? Add it under Opponents first.</span>
        </label>
        <label className="field">
          Home or away
          <select name="is_home" defaultValue={game ? (game.isHome ? "home" : "away") : "home"}>
            <option value="home">Home</option>
            <option value="away">Away</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          Date & time (Taipei)
          <input type="datetime-local" name="starts_at" required defaultValue={game ? isoToTaipeiLocal(game.startsAt) : ""} />
        </label>
        <label className="field">
          Location
          <input name="location" defaultValue={game?.location ?? ""} placeholder="Morrison Gym" />
        </label>
        <label className="field">
          Status
          <select name="status" defaultValue={game?.status ?? "scheduled"}>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="final">Final</option>
            <option value="postponed">Postponed</option>
            <option value="canceled">Canceled</option>
          </select>
        </label>
      </div>
      <fieldset className="card card-pad form" style={{ margin: 0 }}>
        <legend className="eyebrow">Scoring</legend>
        <div className="form-row">
          <label className="field">
            Score source
            <select name="scoring_mode" defaultValue={game?.scoringMode ?? "live"}>
              <option value="live">From the operator&apos;s plays</option>
              <option value="manual">Typed in (no operator)</option>
            </select>
            <span className="hint">Use &quot;typed in&quot; for games nobody tracked live.</span>
          </label>
          <label className="field">
            Broncos score (typed in)
            <input type="number" name="team_score" min={0} defaultValue={game?.teamScore ?? 0} />
          </label>
          <label className="field">
            Opponent score (typed in)
            <input type="number" name="opponent_score" min={0} defaultValue={game?.opponentScore ?? 0} />
          </label>
        </div>
      </fieldset>
      <fieldset className="card card-pad form" style={{ margin: 0 }}>
        <legend className="eyebrow">Rules</legend>
        <div className="form-row">
          <label className="field">
            Minutes per quarter
            <input type="number" name="period_length_minutes" min={1} max={20} defaultValue={game ? game.periodLengthSeconds / 60 : 8} />
          </label>
          <label className="field">
            Team fouls reset every
            <select name="foul_reset" defaultValue={game?.foulReset ?? "quarter"}>
              <option value="quarter">Quarter</option>
              <option value="half">Half</option>
            </select>
          </label>
          <label className="field">
            Bonus after this many team fouls
            <input type="number" name="bonus_threshold" min={1} max={10} defaultValue={game?.bonusThreshold ?? 5} />
          </label>
        </div>
      </fieldset>
    </>
  );
}
