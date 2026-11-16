// Skibo has two marks. A leaf is one day a task was done; a flower is one
// reward drawn. Every place the app draws either one uses these shapes, and
// styles.css repeats them as the --mark-* masks.
export const FLOWER_PATH =
  "M7.73 6.12A4.3 4.3 0 1 1 16.27 6.12A4.3 4.3 0 1 1 18.91 14.25A4.3 4.3 0 1 1 12 19.27A4.3 4.3 0 1 1 5.09 14.25A4.3 4.3 0 1 1 7.73 6.12Z";

export const Mark = ({ kind }: { kind: "leaf" | "flower" | "open" }) => (
  <i className={`mark ${kind}`} aria-hidden="true" />
);

type Growth = "leaf" | "flower" | "gap" | "open";
// Fourteen scheduled days of one task: ten done, two rewarded, one missed,
// and today still open at the tip.
const growth: Growth[] = [
  "leaf",
  "leaf",
  "gap",
  "leaf",
  "leaf",
  "leaf",
  "flower",
  "leaf",
  "leaf",
  "leaf",
  "leaf",
  "flower",
  "leaf",
  "open",
];
const stem = [
  [38, 272],
  [130, 266],
  [232, 198],
  [318, 62],
] as const;
const along = (t: number) => {
  const u = 1 - t;
  const at = (i: 0 | 1) =>
    u ** 3 * stem[0][i] +
    3 * u * u * t * stem[1][i] +
    3 * u * t * t * stem[2][i] +
    t ** 3 * stem[3][i];
  const slope = (i: 0 | 1) =>
    3 * u * u * (stem[1][i] - stem[0][i]) +
    6 * u * t * (stem[2][i] - stem[1][i]) +
    3 * t * t * (stem[3][i] - stem[2][i]);
  return {
    x: at(0),
    y: at(1),
    angle: (Math.atan2(slope(1), slope(0)) * 180) / Math.PI,
  };
};
const blade = (length: number) => {
  const w = length * 0.34;
  return `M0 0C${length * 0.25} ${-w} ${length * 0.75} ${-w} ${length} 0C${length * 0.75} ${w} ${length * 0.25} ${w} 0 0Z`;
};

export const Sprig = () => (
  <svg className="sprig" viewBox="0 0 360 320" aria-hidden="true">
    <path
      className="sprig-stem"
      d={`M${stem[0]}C${stem[1]} ${stem[2]} ${stem[3]}`}
    />
    {growth.map((kind, i) => {
      const last = i === growth.length - 1;
      const { x, y, angle } = along(0.07 + (i / (growth.length - 1)) * 0.93);
      const side = i % 2 ? 1 : -1;
      const turn = angle + (last ? 0 : side * 54);
      if (kind === "gap")
        return <circle key={i} className="sprig-gap" cx={x} cy={y} r={3} />;
      if (kind === "flower") {
        const reach = 24;
        const rad = (turn * Math.PI) / 180;
        const fx = x + Math.cos(rad) * reach;
        const fy = y + Math.sin(rad) * reach;
        const size = 34;
        return (
          <g key={i}>
            <path className="sprig-stalk" d={`M${x} ${y}L${fx} ${fy}`} />
            <g
              transform={`translate(${fx - size / 2} ${fy - size / 2}) scale(${size / 24})`}
            >
              <path className="sprig-flower" d={FLOWER_PATH} />
              <circle className="sprig-eye" cx={12} cy={12} r={2.7} />
            </g>
          </g>
        );
      }
      return (
        <path
          key={i}
          className={kind === "open" ? "sprig-open" : "sprig-leaf"}
          d={blade(48 - i * 1.5)}
          transform={`translate(${x} ${y}) rotate(${turn})`}
        />
      );
    })}
  </svg>
);
