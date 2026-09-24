import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import ChartFrame from './ChartFrame';
import { chartColors, CHART_HEIGHT } from './chartTheme';

/**
 * Single 0–100 radial gauge.
 */
export default function RadialGauge({
  title,
  subtitle,
  value = 0,
  max = 100,
  error,
  unit = '%',
  className = '',
}) {
  const colors = chartColors();
  const n = Number(value) || 0;
  const data = [{ name: title, value: Math.max(0, Math.min(max, n)), fill: colors.series[1] }];
  const empty = !error && (value == null || Number.isNaN(Number(value)));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      error={error}
      empty={empty}
      emptyMessage="No OEE estimate"
      className={className}
      tableColumns={[
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value' },
      ]}
      tableRows={[{ id: 1, metric: title, value: `${n}${unit}` }]}
    >
      <div style={{ position: 'relative', height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="90%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: colors.grid }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            pointerEvents: 'none',
          }}
        >
          <strong style={{ fontSize: 28, color: colors.series[0] }}>
            {n}
            {unit}
          </strong>
        </div>
      </div>
    </ChartFrame>
  );
}
