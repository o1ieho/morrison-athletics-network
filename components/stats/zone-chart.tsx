import { percentage } from "@/lib/basketball";
import { CORNER_ARC_Y, COURT } from "@/lib/court";
import type { ZoneId, ZoneStats } from "@/lib/game-analysis";

const { width: W, depth: D, basket: B } = COURT;
const lane = { left: B.x - COURT.laneHalfWidth, right: B.x + COURT.laneHalfWidth };
const r = COURT.threeRadius;
const cx = COURT.cornerX;

// Zone outlines in court meters. Mid-range and above-the-break use even-odd
// fills to cut out the areas inside them.
const insideArc = `M ${cx} 0 L ${cx} ${CORNER_ARC_Y} A ${r} ${r} 0 0 0 ${W - cx} ${CORNER_ARC_Y} L ${W - cx} 0 Z`;
const paint = `M ${lane.left} 0 H ${lane.right} V ${COURT.freeThrowY} H ${lane.left} Z`;
const PATHS: Record<ZoneId, string> = {
  paint,
  midrange: `${insideArc} ${paint}`,
  corner3Left: `M 0 0 H ${cx} V ${CORNER_ARC_Y} H 0 Z`,
  corner3Right: `M ${W - cx} 0 H ${W} V ${CORNER_ARC_Y} H ${W - cx} Z`,
  aboveBreak3: `M 0 0 H ${W} V ${D} H 0 Z ${insideArc} M 0 0 H ${cx} V ${CORNER_ARC_Y} H 0 Z M ${W - cx} 0 H ${W} V ${CORNER_ARC_Y} H ${W - cx} Z`,
};

// Where each zone's numbers go.
const LABELS: Record<ZoneId, { x: number; y: number; small?: boolean }> = {
  paint: { x: B.x, y: 3.9 },
  midrange: { x: 3.3, y: 3.6 },
  corner3Left: { x: cx / 2, y: CORNER_ARC_Y / 2, small: true },
  corner3Right: { x: W - cx / 2, y: CORNER_ARC_Y / 2, small: true },
  aboveBreak3: { x: B.x, y: 10.6 },
};

/** Flat shade from light grey (cold) to Broncos green (hot) by field-goal %. */
function shade(made: number, attempts: number) {
  if (!attempts) return "var(--zone-empty)";
  const pct = made / attempts;
  if (pct >= 0.55) return "var(--zone-4)";
  if (pct >= 0.45) return "var(--zone-3)";
  if (pct >= 0.35) return "var(--zone-2)";
  return "var(--zone-1)";
}

export function ZoneChart({ stats }: { stats: ZoneStats }) {
  return (
    <div className="zone-chart">
      <svg viewBox={`0 0 ${W} ${D}`} role="img" aria-label="Shooting by zone">
        {(Object.keys(PATHS) as ZoneId[]).map((zone) => (
          <path key={zone} d={PATHS[zone]} fillRule="evenodd" fill={shade(stats[zone].made, stats[zone].attempts)} className="zone" />
        ))}
        {/* Court lines on top */}
        <g className="zone-lines">
          <rect x="0" y="0" width={W} height={D} />
          <path d={insideArc} />
          <path d={paint} />
          <circle cx={B.x} cy={B.y} r="0.225" />
          <line x1={B.x - 0.9} y1={COURT.backboardY} x2={B.x + 0.9} y2={COURT.backboardY} />
        </g>
        {(Object.keys(LABELS) as ZoneId[]).map((zone) => {
          const { made, attempts } = stats[zone];
          const at = LABELS[zone];
          return (
            <g key={zone} className={`zone-label ${at.small ? "small" : ""}`} transform={`translate(${at.x} ${at.y})`}>
              <text y="-0.15">{attempts ? percentage(made, attempts) : "–"}</text>
              <text y="0.55" className="zone-count">
                {made}/{attempts}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ZoneLegend() {
  return (
    <div className="legend">
      <span>
        <i className="swatch" style={{ background: "var(--zone-1)" }} /> Under 35%
      </span>
      <span>
        <i className="swatch" style={{ background: "var(--zone-2)" }} /> 35–44%
      </span>
      <span>
        <i className="swatch" style={{ background: "var(--zone-3)" }} /> 45–54%
      </span>
      <span>
        <i className="swatch" style={{ background: "var(--zone-4)" }} /> 55%+
      </span>
    </div>
  );
}
