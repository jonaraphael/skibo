import { Completion } from "../app/types";
export const RecordChart = ({
  events,
  compact = false,
}: {
  events: Completion[];
  compact?: boolean;
}) => {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const width = 640,
    height = compact ? 90 : 200;
  const bottom = height - 18,
    top = 16;
  const first = sorted.length ? new Date(sorted[0].at).getTime() : 0;
  const last = sorted.length ? new Date(sorted.at(-1)!.at).getTime() : 1;
  const x = (i: number) =>
    12 +
    (last > first
      ? (new Date(sorted[i].at).getTime() - first) / (last - first)
      : (i + 1) / (sorted.length + 1)) *
      (width - 36);
  const y = (i: number) =>
    bottom - ((i + 1) / Math.max(sorted.length, 4)) * (bottom - top);
  let path = `M12 ${bottom}`;
  sorted.forEach((_, i) => {
    path += ` H${x(i)} V${y(i)}`;
  });
  path += ` H${width - 12}`;
  const paid = sorted.filter((e) => e.reward).length;
  return (
    <figure className={`record-chart ${compact ? "compact" : ""}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Cumulative record: ${sorted.length} completions, ${paid} rewards. Amber marks show rewards.`}
      >
        {[0, 1, 2, 3].map((n) => (
          <line
            key={n}
            x1="12"
            x2={width - 12}
            y1={top + (n * (bottom - top)) / 3}
            y2={top + (n * (bottom - top)) / 3}
            className="chart-grid"
          />
        ))}
        <path d={path} className="chart-line" />
        {sorted.map(
          (e, i) =>
            e.reward && (
              <circle
                key={e.id}
                cx={x(i)}
                cy={y(i)}
                r={7}
                className="chart-reward"
              />
            ),
        )}
      </svg>
      <figcaption>
        <span>
          <i className="legend-line" /> Completions over time
        </span>
        <span>
          <i className="reward-dot" /> Reward earned
        </span>
      </figcaption>
    </figure>
  );
};
