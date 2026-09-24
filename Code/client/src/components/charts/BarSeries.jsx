import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import ChartFrame from './ChartFrame';
import { chartColors, CHART_HEIGHT } from './chartTheme';

/**
 * Grouped or stacked bar chart. series: [{ key, label, stackId? }]
 */
export default function BarSeries({
  title,
  subtitle,
  data = [],
  xKey = 'name',
  series = [],
  layout = 'horizontal',
  stacked = false,
  target,
  targetLabel = 'Target',
  error,
  legend = true,
  className = '',
}) {
  const colors = chartColors();
  const empty = !error && (!data || data.length === 0);
  const keys = series.length ? series : [{ key: 'value', label: 'Value' }];
  const showLegend = legend && keys.length >= 2;

  const tableColumns = [
    { key: xKey, label: 'Category' },
    ...keys.map((s) => ({ key: s.key, label: s.label || s.key })),
  ];
  const tableRows = (data || []).map((d, i) => ({ id: i, ...d }));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      error={error}
      empty={empty}
      tableColumns={tableColumns}
      tableRows={tableRows}
      className={className}
      legend={
        showLegend ? (
          <span className="chart-frame__legend muted">
            {keys.map((s, i) => (
              <span key={s.key} style={{ marginLeft: 8 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: colors.series[i % colors.series.length],
                    marginRight: 4,
                  }}
                />
                {s.label || s.key}
              </span>
            ))}
          </span>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart
          data={data}
          layout={layout === 'vertical' ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          {layout === 'vertical' ? (
            <>
              <XAxis type="number" tick={{ fill: colors.axis, fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey={xKey}
                width={88}
                tick={{ fill: colors.axis, fontSize: 11 }}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fill: colors.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: colors.axis, fontSize: 11 }} width={48} />
            </>
          )}
          <Tooltip />
          {showLegend ? <Legend /> : null}
          {target != null ? (
            <ReferenceLine
              {...(layout === 'vertical' ? { x: target } : { y: target })}
              stroke={colors.target}
              strokeDasharray="4 4"
              label={{ value: targetLabel, fill: colors.target, fontSize: 11 }}
            />
          ) : null}
          {keys.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label || s.key}
              stackId={s.stackId ?? (stacked ? 'stack' : undefined)}
              fill={colors.series[i % colors.series.length]}
              radius={stacked || s.stackId ? 0 : [4, 4, 0, 0]}
            >
              {keys.length === 1 && data.some((d) => d.fill)
                ? data.map((d, di) => <Cell key={di} fill={d.fill || colors.series[0]} />)
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
