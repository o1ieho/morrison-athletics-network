import { periodLabel, periodLengthSeconds } from "@/lib/basketball";
import type { GameFlow } from "@/lib/game-analysis";
import type { Game } from "@/lib/types";

const W = 800;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 40 };

/**
 * The score margin over the game as a step chart: green above the line when
 * the Broncos lead, grey below when the opponent does. Flat fills, no gradients.
 */
export function GameFlowChart({
  flow,
  game,
  opponentName,
  nowT,
}: {
  flow: GameFlow;
  game: Pick<Game, "periodCount" | "periodLengthSeconds" | "overtimeLengthSeconds">;
  opponentName: string;
  /** For live games: extend the line to the current game time. */
  nowT?: number;
}) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const maxAbs = Math.max(6, ...flow.points.map((point) => Math.abs(point.margin)));
  const limit = Math.ceil(maxAbs / 5) * 5;
  const x = (t: number) => PAD.left + (Math.min(t, flow.duration) / flow.duration) * plotW;
  const y = (margin: number) => PAD.top + ((limit - margin) / (2 * limit)) * plotH;
  const zero = y(0);

  // Step path: hold the margin until the next score, then jump.
  const end = Math.min(nowT ?? flow.points[flow.points.length - 1].t, flow.duration);
  let line = `M ${x(0)} ${zero}`;
  for (let i = 1; i < flow.points.length; i += 1) {
    const point = flow.points[i];
    line += ` H ${x(point.t)} V ${y(point.margin)}`;
  }
  line += ` H ${x(Math.max(end, flow.points[flow.points.length - 1].t))}`;
  const area = `${line} V ${zero} Z`;

  // Period boundaries.
  const boundaries: Array<{ t: number; label: string }> = [];
  let t = 0;
  for (let period = 1; t < flow.duration; period += 1) {
    boundaries.push({ t, label: periodLabel(period, game.periodCount) });
    t += periodLengthSeconds(game, period);
  }

  return (
    <figure className="flow">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Game flow: largest Broncos lead ${flow.largestLead.team}, largest ${opponentName} lead ${flow.largestLead.opponent}`}>
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
      </dl>
    </figure>
  );
}
