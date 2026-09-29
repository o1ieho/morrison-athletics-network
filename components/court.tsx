import type { ReactNode } from "react";
import { CORNER_ARC_Y, COURT } from "@/lib/court";

type Shot = { id: string; x: number; y: number; made: boolean; label?: string; pending?: boolean };

const { width: W, depth: D, basket: B } = COURT;

/** FIBA half court with the baseline at the top. Children are overlaid (e.g. tap targets). */
export function Court({ shots = [], children, className = "" }: { shots?: Shot[]; children?: ReactNode; className?: string }) {
  const lane = { left: B.x - COURT.laneHalfWidth, right: B.x + COURT.laneHalfWidth };
  const r = COURT.threeRadius;
  const ra = COURT.restrictedRadius;
  return (
    <div className={`court ${className}`}>
      <svg viewBox={`0 0 ${W} ${D}`} aria-hidden="true" preserveAspectRatio="none">
        <rect x="0" y="0" width={W} height={D} />
        {/* Three-point line */}
        <path d={`M ${COURT.cornerX} 0 L ${COURT.cornerX} ${CORNER_ARC_Y} A ${r} ${r} 0 0 0 ${W - COURT.cornerX} ${CORNER_ARC_Y} L ${W - COURT.cornerX} 0`} />
        {/* Lane and free-throw circle */}
        <rect x={lane.left} y="0" width={lane.right - lane.left} height={COURT.freeThrowY} />
        <path d={`M ${B.x - COURT.circleRadius} ${COURT.freeThrowY} A ${COURT.circleRadius} ${COURT.circleRadius} 0 0 0 ${B.x + COURT.circleRadius} ${COURT.freeThrowY}`} />
        <path
          d={`M ${B.x - COURT.circleRadius} ${COURT.freeThrowY} A ${COURT.circleRadius} ${COURT.circleRadius} 0 0 1 ${B.x + COURT.circleRadius} ${COURT.freeThrowY}`}
          strokeDasharray="0.3 0.3"
        />
        {/* Restricted area, backboard, rim */}
        <path d={`M ${B.x - ra} ${COURT.backboardY} L ${B.x - ra} ${B.y} A ${ra} ${ra} 0 0 0 ${B.x + ra} ${B.y} L ${B.x + ra} ${COURT.backboardY}`} />
        <line x1={B.x - 0.9} y1={COURT.backboardY} x2={B.x + 0.9} y2={COURT.backboardY} strokeWidth="0.12" />
        <circle cx={B.x} cy={B.y} r="0.225" />
        {/* Center circle */}
        <path d={`M ${B.x - COURT.circleRadius} ${D} A ${COURT.circleRadius} ${COURT.circleRadius} 0 0 1 ${B.x + COURT.circleRadius} ${D}`} />
      </svg>
      {shots.map((shot) => (
        <span
          key={shot.id}
          className={`shot ${shot.pending ? "pending" : shot.made ? "made" : "missed"}`}
          style={{ left: `${shot.x * 100}%`, top: `${shot.y * 100}%` }}
          title={shot.label}
        />
      ))}
      {children}
    </div>
  );
}

export function CourtLegend() {
  return (
    <div className="legend">
      <span>
        <i className="shot made" aria-hidden="true" /> Made
      </span>
      <span>
        <i className="shot missed" aria-hidden="true" /> Missed
      </span>
    </div>
  );
}
