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

const DEFAULT_PALETTE = ["#d97757", "#c2613f", "#e0a08a", "#8c4a32", "#b4b2a8", "#6b8e8a"];

const axisStyle = { fill: "#b4b2a8", fontSize: 12 };
const tooltipStyle = {
  background: "#30302e",
  border: "1px solid #46443f",
  borderRadius: 8,
  color: "#f5f4ef",
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
            {showGrid && <CartesianGrid stroke="#46443f" strokeDasharray="3 3" />}
            <XAxis dataKey={spec.xKey} tick={axisStyle} stroke="#46443f" />
            <YAxis tick={axisStyle} stroke="#46443f" />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#46443f" }} />
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
            {showGrid && <CartesianGrid stroke="#46443f" strokeDasharray="3 3" vertical={false} />}
            <XAxis dataKey={spec.xKey} tick={axisStyle} stroke="#46443f" />
            <YAxis tick={axisStyle} stroke="#46443f" />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#3a3a37" }} />
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
