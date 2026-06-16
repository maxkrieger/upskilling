import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "../../shared/types.ts";

const DEFAULT_PALETTE = ["#CF6B33", "#B85B28", "#E09B6F", "#8c4a32", "#C9A98C", "#6b8e8a"];

const axisStyle = { fill: "#6E6A62", fontSize: 12 };
const GRID = "#E7E1D6";
const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E7E1D6",
  borderRadius: 8,
  color: "#29251F",
};

export function ChartBlock({ spec }: { spec: ChartSpec }) {
  const style = spec.style ?? {};
  const palette = style.palette?.length ? style.palette : DEFAULT_PALETTE;
  const showGrid = style.gridlines ?? false;
  const showLegend = style.legend ?? false;

  let data = spec.data;
  if (spec.kind === "bar" && style.sorted) {
    const key = spec.series[0];
    data = [...data].sort((a, b) => Number(b[key]) - Number(a[key]));
  }

  return (
    <div className="my-3 rounded-xl border border-border bg-surface p-3">
      {spec.title && (
        <div className="mb-2 text-sm font-medium text-ink">{spec.title}</div>
      )}
      <ResponsiveContainer width="100%" height={260}>
        {spec.kind === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
            {showGrid && <CartesianGrid stroke={GRID} strokeDasharray="3 3" />}
            <XAxis dataKey={spec.xKey} tick={axisStyle} stroke={GRID} />
            <YAxis tick={axisStyle} stroke={GRID} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: GRID }} />
            {showLegend && <Legend />}
            {spec.series.map((s, i) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={palette[i % palette.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : spec.kind === "pie" ? (
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            {showLegend && <Legend />}
            <Pie
              data={data}
              dataKey={spec.series[0]}
              nameKey={spec.xKey}
              outerRadius={90}
              label
            >
              {data.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
            {showGrid && <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />}
            <XAxis dataKey={spec.xKey} tick={axisStyle} stroke={GRID} />
            <YAxis tick={axisStyle} stroke={GRID} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F1ECE3" }} />
            {showLegend && <Legend />}
            {spec.series.map((s, si) => (
              <Bar
                key={s}
                dataKey={s}
                radius={[4, 4, 0, 0]}
                fill={palette[si % palette.length]}
              >
                {/* For a single series, color each bar from the palette. */}
                {spec.series.length === 1 &&
                  data.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
              </Bar>
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
