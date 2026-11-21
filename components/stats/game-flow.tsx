"use client";

import { useEffect, useState } from "react";
import { formatClock, periodLabel, periodLengthSeconds } from "@/lib/basketball";
import type { GameFlow, Run } from "@/lib/game-analysis";
import type { Game } from "@/lib/types";
import { isCatchingUp } from "@/lib/use-catch-up";
import { useFlashKey } from "@/lib/use-flash";

type Rules = Pick<Game, "periodCount" | "periodLengthSeconds" | "overtimeLengthSeconds">;

const W = 800;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 40 };

/** The y-axis runs ±limit, rounded up to a multiple of 5 so it only rescales now and then. */
function marginLimit(flow: GameFlow) {
  const maxAbs = Math.max(6, ...flow.points.map((point) => Math.abs(point.margin)));
  return Math.ceil(maxAbs / 5) * 5;
}

/** Step path: hold the margin until the next score, then jump. Ends at `end` (or the last score). */
function stepPath(flow: GameFlow, x: (t: number) => number, y: (margin: number) => number, end: number) {
  let line = `M ${x(0)} ${y(0)}`;
  for (let i = 1; i < flow.points.length; i += 1) {
    const point = flow.points[i];
    line += ` H ${x(point.t)} V ${y(point.margin)}`;
  }
  line += ` H ${x(Math.max(end, flow.points[flow.points.length - 1].t))}`;
  return { line, area: `${line} V ${y(0)} Z` };
}

function periodStarts(game: Rules, duration: number) {
  const boundaries: Array<{ t: number; label: string }> = [];
  let t = 0;
  for (let period = 1; t < duration; period += 1) {
    boundaries.push({ t, label: periodLabel(period, game.periodCount) });
    t += periodLengthSeconds(game, period);
  }
  return boundaries;
}

/**
 * The score margin over the game as a step chart: green above the line when
 * the Broncos lead, grey below when the opponent does. Flat fills, no gradients.
 * It draws itself left to right once when the tab is opened (a user action),
 * never on page load.
 */
export function GameFlowChart({
  flow,
  game,
  opponentName,
  nowT,
  biggestRun,
}: {
  flow: GameFlow;
  game: Rules;
  opponentName: string;
  /** For live games: extend the line to the current game time. */
  nowT?: number;
  /** The game's biggest unanswered run, for the stats underneath. */
  biggestRun?: Run | null;
}) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const limit = marginLimit(flow);
  const x = (t: number) => PAD.left + (Math.min(t, flow.duration) / flow.duration) * plotW;
  const y = (margin: number) => PAD.top + ((limit - margin) / (2 * limit)) * plotH;
  const zero = y(0);
  const { line, area } = stepPath(flow, x, y, Math.min(nowT ?? flow.points[flow.points.length - 1].t, flow.duration));
  const boundaries = periodStarts(game, flow.duration);

  return (
    <figure className="flow">
      <svg className="flow-reveal" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Lead tracker: largest Broncos lead ${flow.largestLead.team}, largest ${opponentName} lead ${flow.largestLead.opponent}`}>
        <defs>
          <clipPath id="flow-above">
            <rect x={0} y={0} width={W} height={zero} />
          </clipPath>
          <clipPath id="flow-below">
            <rect x={0} y={zero} width={W} height={H - zero} />
          </clipPath>
        </defs>

        {boundaries.map((boundary) => (
          <g key={boundary.t}>
            {boundary.t > 0 && <line className="flow-grid" x1={x(boundary.t)} x2={x(boundary.t)} y1={PAD.top} y2={H - PAD.bottom} />}
            <text className="flow-axis" x={x(boundary.t) + 6} y={H - 8}>
              {boundary.label}
            </text>
          </g>
        ))}
        {[limit, limit / 2, -limit / 2, -limit].map((value) => (
          <text key={value} className="flow-axis" x={PAD.left - 8} y={y(value) + 4} textAnchor="end">
            {value > 0 ? `+${value}` : value}
          </text>
        ))}

        <path d={area} className="flow-area-team" clipPath="url(#flow-above)" />
        <path d={area} className="flow-area-opponent" clipPath="url(#flow-below)" />
        <line className="flow-zero" x1={PAD.left} x2={W - PAD.right} y1={zero} y2={zero} />
        <path d={line} className="flow-line" />
      </svg>
      <figcaption className="flow-legend">
        <span>
          <i className="swatch team" /> Broncos ahead
        </span>
        <span>
          <i className="swatch opponent" /> {opponentName} ahead
        </span>
      </figcaption>
      <dl className="flow-stats">
        <div>
          <dt>Lead changes</dt>
          <dd>{flow.leadChanges}</dd>
        </div>
        <div>
          <dt>Times tied</dt>
          <dd>{flow.ties}</dd>
        </div>
        <div>
          <dt>Biggest Broncos lead</dt>
          <dd>{flow.largestLead.team}</dd>
        </div>
        <div>
          <dt>Biggest {opponentName} lead</dt>
          <dd>{flow.largestLead.opponent}</dd>
        </div>
        {biggestRun && (
          <div>
            <dt>Biggest run</dt>
            <dd>
              {biggestRun.side === "team" ? "Broncos" : opponentName} {biggestRun.points}-0
            </dd>
          </div>
        )}
      </dl>
    </figure>
  );
}

// ---------------------------------------------------------------- Lead strip

const SW = 1000;
const SH = 56;
const SPAD = 4;

/**
 * The compact lead tracker that sits under the scoreboard: the same step
 * chart in a 56px strip, with runs of 8+ shaded, a yellow "now" line for a
 * live game, and four numbers underneath. While live, only the newest stretch
 * grows in (a clip that widens from the old end to the new one); when the
 * y-scale has to change, the chart crossfades instead of morphing every point.
 */
export function LeadStrip({
  flow,
  game,
  opponentName,
  nowT,
  runs,
  leading,
}: {
  flow: GameFlow;
  game: Rules;
  opponentName: string;
  /** Current game time for a live game (moves in steps, not every second). */
  nowT?: number;
  /** Big runs to shade behind the chart, in game seconds. */
  runs: Array<{ id: string; startT: number; endT: number }>;
  /** Seconds each side has been ahead. */
  leading: { team: number; opponent: number };
}) {
  const limit = marginLimit(flow);
  const rescaled = useFlashKey(limit);
  // The clip only eases once the page has settled and not while catching up
  // (after load or a wake), so a jump of several plays doesn't sweep across.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 100);
    return () => window.clearTimeout(timer);
  }, []);
  const x = (t: number) => (Math.min(Math.max(t, 0), flow.duration) / flow.duration) * SW;
  const y = (margin: number) => SPAD + ((limit - margin) / (2 * limit)) * (SH - 2 * SPAD);
  const zero = y(0);
  const lastT = flow.points[flow.points.length - 1].t;
  const end = Math.min(Math.max(nowT ?? lastT, lastT), flow.duration);
  const { line, area } = stepPath(flow, x, y, end);
  const boundaries = periodStarts(game, flow.duration);
  const empty = flow.points.length === 1;
  // The right edge of what's drawn, as a share of the strip; the clip eases between values.
  const shownShare = x(end) / SW;
  const tick = (t: number) => `${(x(t) / SW) * 100}%`;

  return (
    <section className="card lead-strip" aria-label="Lead tracker">
      <div className="lead-strip-head">
        <h2>Lead tracker</h2>
        <span className="flow-legend" aria-hidden="true">
          <span>
            <i className="swatch team" /> Broncos ahead
          </span>
          <span>
            <i className="swatch opponent" /> {opponentName} ahead
          </span>
          {runs.length > 0 && (
            <span>
              <i className="swatch run" /> 8+ run
            </span>
          )}
        </span>
      </div>
      <div className="lead-strip-plot">
        <svg className="lead-strip-back" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" aria-hidden="true">
          {runs.map((run) => {
            const from = x(run.startT);
            return <rect key={run.id} className="lead-strip-run" x={from} y={0} width={Math.max(x(run.endT) - from, 6)} height={SH} />;
          })}
          {boundaries.map(
            (boundary) => boundary.t > 0 && <line key={boundary.t} className="lead-strip-grid" x1={x(boundary.t)} x2={x(boundary.t)} y1={0} y2={SH} />,
          )}
          <line className="lead-strip-zero" x1={0} x2={SW} y1={zero} y2={zero} />
        </svg>
        {!empty && (
          <svg
            key={rescaled}
            className={`lead-strip-front ${rescaled ? "rescaled" : ""} ${settled && !isCatchingUp() ? "settled" : ""}`}
            viewBox={`0 0 ${SW} ${SH}`}
            preserveAspectRatio="none"
            style={{ clipPath: `inset(0 ${(1 - shownShare) * 100}% 0 0)` }}
            role="img"
            aria-label={`Lead tracker: largest Broncos lead ${flow.largestLead.team}, largest ${opponentName} lead ${flow.largestLead.opponent}`}
          >
            <path d={area} className="flow-area-team" clipPath="url(#lead-strip-above)" />
            <path d={area} className="flow-area-opponent" clipPath="url(#lead-strip-below)" />
            <path d={line} className="lead-strip-line" />
            <defs>
              <clipPath id="lead-strip-above">
                <rect x={0} y={0} width={SW} height={zero} />
              </clipPath>
              <clipPath id="lead-strip-below">
                <rect x={0} y={zero} width={SW} height={SH - zero} />
              </clipPath>
            </defs>
          </svg>
        )}
        {nowT !== undefined && <span className="lead-strip-now" style={{ left: tick(end) }} aria-hidden="true" />}
      </div>
      <div className="lead-strip-axis" aria-hidden="true">
        {empty && <span style={{ left: 0 }}>Tip-off</span>}
        {boundaries.map(
          (boundary) =>
            !(empty && boundary.t === 0) && (
              <span key={boundary.t} style={{ left: tick(boundary.t) }}>
                {boundary.label}
              </span>
            ),
        )}
      </div>
      <dl className="lead-strip-stats">
        <div>
          <dt>Lead changes</dt>
          <dd>{flow.leadChanges}</dd>
        </div>
        <div>
          <dt>Times tied</dt>
          <dd>{flow.ties}</dd>
        </div>
        <div>
          <dt>Biggest lead</dt>
          <dd>
            <span>
              <small>Broncos</small> {flow.largestLead.team}
            </span>
            <span>
              <small>{opponentName}</small> {flow.largestLead.opponent}
            </span>
          </dd>
        </div>
        <div>
          <dt>Time leading</dt>
          <dd>
            <span>
              <small>Broncos</small> {formatClock(leading.team)}
            </span>
            <span>
              <small>{opponentName}</small> {formatClock(leading.opponent)}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
