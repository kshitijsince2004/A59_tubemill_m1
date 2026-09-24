import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import ChartFrame from './ChartFrame';
import { chartColors, CHART_HEIGHT } from './chartTheme';

/**
 * Single-series trend (line or area). Optional horizontal target reference.
 */
export default function TrendLine({
  title,
  subtitle,
  data = [],
  xKey = 'date',
  yKey = 'value',
  yLabel,
  area = false,
  target,
  targetLabel = 'Target',
  error,
  formatX,
  formatY,
  className = '',
}) {
  const colors = chartColors();
  const empty = !error && (!data || data.length === 0);
  const Chart = area ? AreaChart : LineChart;

  const tableColumns = [
    { key: xKey, label: 'Date' },
    { key: yKey, label: yLabel || yKey },
  ];
  const tableRows = (data || []).map((d, i) => ({
    id: i,
    [xKey]: d[xKey],
    [yKey]: d[yKey],
  }));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      error={error}
      empty={empty}
      tableColumns={tableColumns}
      tableRows={tableRows}
      className={className}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <Chart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickFormatter={formatX}
          />
          <YAxis
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickFormatter={formatY}
            width={48}
          />
          <Tooltip
            formatter={(v) => [formatY ? formatY(v) : v, yLabel || yKey]}
            labelFormatter={(l) => (formatX ? formatX(l) : l)}
          />
          {target != null ? (
            <ReferenceLine
              y={target}
              stroke={colors.target}
              strokeDasharray="4 4"
              label={{ value: targetLabel, fill: colors.target, fontSize: 11 }}
            />
          ) : null}
          {area ? (
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={colors.series[0]}
              fill={colors.series[0]}
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : (
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={colors.series[0]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
