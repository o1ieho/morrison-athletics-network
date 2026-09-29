import type { LineScore } from "@/lib/game-analysis";

/** Quarter-by-quarter score, like the box on a TV broadcast. */
export function LineScoreTable({ line, opponentName }: { line: LineScore; opponentName: string }) {
  const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
  return (
    <div className="table-wrap">
      <table className="table line-score">
        <thead>
          <tr>
            <th>Team</th>
            {line.labels.map((label) => (
              <th key={label}>{label}</th>
            ))}
            <th>T</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Broncos", line.team],
            [opponentName, line.opponent],
          ].map(([name, values]) => (
            <tr key={name as string}>
              <td>
                <strong>{name as string}</strong>
              </td>
              {(values as number[]).map((value, index) => (
                <td key={line.labels[index]}>{value}</td>
              ))}
              <td>
                <strong>{total(values as number[])}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
