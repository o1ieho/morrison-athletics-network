const W = 320;
const H = 90;
const PAD = 10;

/** Points per game across the season, oldest to newest, with the average marked. */
export function Sparkline({ values, labels, unit = "PTS" }: { values: number[]; labels: string[]; unit?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const x = (index: number) => PAD + (index / (values.length - 1)) * (W - PAD * 2);
  const y = (value: number) => H - PAD - (value / max) * (H - PAD * 2);
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");

  return (
    <figure className="sparkline">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${unit} by game: ${values.join(", ")}`}>
        <line className="sparkline-avg" x1={PAD} x2={W - PAD} y1={y(average)} y2={y(average)} />
        <polyline className="sparkline-line" points={points} />
        {values.map((value, index) => (
          <rect key={labels[index] ?? index} className="sparkline-dot" x={x(index) - 3.5} y={y(value) - 3.5} width="7" height="7">
            {/* One string child: React requires a single text node inside <title>. */}
            <title>{`${labels[index]}: ${value} ${unit}`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="muted small">
        {unit} by game · dashed line = season average ({average.toFixed(1)})
      </figcaption>
    </figure>
  );
}
